(function(global) {
    "use strict";

    function ensureSeoForecastStore(memory) {
        var store;
        var forecast;

        if (memory && memory.seoAgent) {
            store = memory.seoAgent;
        } else if (typeof global.ensureSeoAgentStore === "function" && typeof global.getSeoAgentMemory === "function") {
            store = global.ensureSeoAgentStore(global.getSeoAgentMemory());
        } else {
            return null;
        }

        if (!store) {
            return null;
        }

        if (!store.forecast || typeof store.forecast !== "object") {
            store.forecast = {
                currentTraffic: 0,
                projectedTraffic: 0,
                currentLeads: 0,
                projectedLeads: 0,
                currentRevenue: 0,
                projectedRevenue: 0,
                currentRank: 0,
                projectedRank: 0,
                estimatedMonths: 0,
                confidence: "LOW",
                recommendations: [],
                lastUpdated: null
            };
        }

        forecast = store.forecast;

        if (!Array.isArray(forecast.recommendations)) {
            forecast.recommendations = [];
        }

        return forecast;
    }

    function saveSeoForecastState(forecast) {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;

        if (!forecast || !memory || typeof global.saveSeoAgentMemory !== "function") {
            return null;
        }

        forecast.lastUpdated = new Date().toISOString();
        global.saveSeoAgentMemory(memory);
        return forecast;
    }

    function hashSeed(value) {
        if (typeof global.seoHashSeed === "function") {
            return global.seoHashSeed(value);
        }

        var str = String(value || "");
        var hash = 0;
        var index;

        for (index = 0; index < str.length; index++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(index);
            hash |= 0;
        }

        return Math.abs(hash);
    }

    function createRecordId() {
        return typeof global.createSeoRecordId === "function"
            ? global.createSeoRecordId()
            : "seo_" + Date.now() + "_" + Math.random().toString(36).slice(2, 9);
    }

    function getBaselineSeed() {
        var memory = typeof global.loadExecutiveMemory === "function" ? global.loadExecutiveMemory() : null;
        var store = memory && typeof global.ensureSeoAgentStore === "function" ? global.ensureSeoAgentStore(memory) : null;
        var parts = [];

        if (store) {
            parts.push(String(store.keywords.length || 0));
            parts.push(String(store.audits.length || 0));
            parts.push(String(store.opportunities.length || 0));
        }

        return hashSeed(parts.join("_") || "seo_forecast_baseline");
    }

    function formatCurrency(value) {
        return "$" + Number(value || 0).toLocaleString("en-US");
    }

    function forecastTrafficGrowth() {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;
        var store = memory && typeof global.ensureSeoAgentStore === "function" ? global.ensureSeoAgentStore(memory) : null;
        var forecast = ensureSeoForecastStore(memory);
        var seed = getBaselineSeed();
        var keywordBoost = store && store.keywords.length ? Math.min(400, store.keywords.length * 25) : 0;
        var current;
        var projected;

        if (!forecast) {
            return null;
        }

        current = 300 + (seed % 700) + keywordBoost;
        projected = Math.round(current * (1.8 + ((seed % 12) / 10)));
        forecast.currentTraffic = current;
        forecast.projectedTraffic = projected;
        saveSeoForecastState(forecast);

        if (store) {
            store.status = "forecasting";
        }

        return {
            currentTraffic: current,
            projectedTraffic: projected
        };
    }

    function forecastLeadGrowth() {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;
        var forecast = ensureSeoForecastStore(memory);
        var seed = getBaselineSeed();
        var current;
        var projected;
        var conversionRate = 0.012 + ((seed % 8) / 1000);

        if (!forecast) {
            return null;
        }

        if (!forecast.currentTraffic) {
            forecastTrafficGrowth();
        }

        current = Math.max(3, Math.round((forecast.currentTraffic || 500) * conversionRate));
        projected = Math.max(current + 1, Math.round((forecast.projectedTraffic || current * 2) * (conversionRate + 0.008)));
        forecast.currentLeads = current;
        forecast.projectedLeads = projected;
        saveSeoForecastState(forecast);

        return {
            currentLeads: current,
            projectedLeads: projected
        };
    }

    function forecastRevenueGrowth() {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;
        var forecast = ensureSeoForecastStore(memory);
        var seed = getBaselineSeed();
        var avgLeadValue = 120 + (seed % 280);
        var current;
        var projected;

        if (!forecast) {
            return null;
        }

        if (!forecast.currentLeads) {
            forecastLeadGrowth();
        }

        current = Math.round((forecast.currentLeads || 7) * avgLeadValue);
        projected = Math.round((forecast.projectedLeads || current) * (avgLeadValue + 40));
        forecast.currentRevenue = current;
        forecast.projectedRevenue = projected;
        saveSeoForecastState(forecast);

        return {
            currentRevenue: current,
            projectedRevenue: projected
        };
    }

    function forecastRankImprovement() {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;
        var store = memory && typeof global.ensureSeoAgentStore === "function" ? global.ensureSeoAgentStore(memory) : null;
        var forecast = ensureSeoForecastStore(memory);
        var seed = getBaselineSeed();
        var opportunityScore = store && typeof global.calculateSeoOpportunityScore === "function"
            ? global.calculateSeoOpportunityScore()
            : 0;
        var current;
        var projected;
        var lift;

        if (!forecast) {
            return null;
        }

        current = 12 + (seed % 30);
        lift = Math.max(4, Math.round((opportunityScore / 100) * 14) + (seed % 6));
        projected = Math.max(1, current - lift);
        forecast.currentRank = current;
        forecast.projectedRank = projected;
        saveSeoForecastState(forecast);

        return {
            currentRank: current,
            projectedRank: projected
        };
    }

    function forecastTimeToResults() {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;
        var store = memory && typeof global.ensureSeoAgentStore === "function" ? global.ensureSeoAgentStore(memory) : null;
        var forecast = ensureSeoForecastStore(memory);
        var seed = getBaselineSeed();
        var technicalScore = 0;
        var localScore = 0;
        var months;
        var recommendations = [];

        if (!forecast) {
            return null;
        }

        if (typeof global.getSeoTechnicalSummary === "function") {
            technicalScore = global.getSeoTechnicalSummary().technicalSeoScore || 0;
        }

        if (typeof global.getSeoLocalSummary === "function") {
            localScore = global.getSeoLocalSummary().localSeoScore || 0;
        }

        months = 6 + (seed % 5);
        if (technicalScore > 0 && technicalScore < 60) {
            months = Math.max(2, months - 2);
            recommendations.push({
                id: createRecordId(),
                area: "technical fixes",
                timeline: "1-2 months",
                createdAt: new Date().toISOString()
            });
        }

        if (localScore > 0 && localScore < 65) {
            recommendations.push({
                id: createRecordId(),
                area: "local citations",
                timeline: "3-6 months",
                createdAt: new Date().toISOString()
            });
            recommendations.push({
                id: createRecordId(),
                area: "reviews",
                timeline: "2-4 months",
                createdAt: new Date().toISOString()
            });
        }

        if (store && store.keywords.length) {
            recommendations.push({
                id: createRecordId(),
                area: "city pages",
                timeline: "4-8 months",
                createdAt: new Date().toISOString()
            });
        }

        forecast.estimatedMonths = months;
        forecast.recommendations = recommendations.concat(forecast.recommendations).slice(0, 20);
        saveSeoForecastState(forecast);

        return {
            estimatedMonths: months,
            recommendations: recommendations
        };
    }

    function calculateForecastConfidence() {
        var memory = typeof global.loadExecutiveMemory === "function" ? global.loadExecutiveMemory() : null;
        var store = memory && typeof global.ensureSeoAgentStore === "function" ? global.ensureSeoAgentStore(memory) : null;
        var forecast = ensureSeoForecastStore(memory);
        var points = 0;
        var confidence = "LOW";

        if (!forecast) {
            return { confidence: "LOW", score: 0 };
        }

        if (store && store.audits.length) {
            points += 1;
        }

        if (store && store.keywords.length) {
            points += 1;
        }

        if (store && typeof global.getSeoLegacyCompetitorCount === "function" && global.getSeoLegacyCompetitorCount(store)) {
            points += 1;
        }

        if (forecast.projectedTraffic > forecast.currentTraffic) {
            points += 1;
        }

        if (forecast.projectedRank > 0 && forecast.projectedRank < forecast.currentRank) {
            points += 1;
        }

        if (points >= 4) {
            confidence = "HIGH";
        } else if (points >= 2) {
            confidence = "MEDIUM";
        }

        forecast.confidence = confidence;
        saveSeoForecastState(forecast);

        return {
            confidence: confidence,
            score: points
        };
    }

    function generateSeoForecast() {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;
        var store = memory && typeof global.ensureSeoAgentStore === "function" ? global.ensureSeoAgentStore(memory) : null;
        var forecast = ensureSeoForecastStore(memory);
        var traffic;
        var leads;
        var revenue;
        var rank;
        var timeline;
        var confidenceResult;
        var summary;

        if (!forecast) {
            return null;
        }

        traffic = forecastTrafficGrowth();
        leads = forecastLeadGrowth();
        revenue = forecastRevenueGrowth();
        rank = forecastRankImprovement();
        timeline = forecastTimeToResults();
        confidenceResult = calculateForecastConfidence();

        if (store) {
            store.status = "forecasting";
            store.lastAnalysis = {
                type: "seo_projection_forecast",
                forecast: forecast,
                timestamp: new Date().toISOString()
            };
        }

        if (global.seoAgentState) {
            global.seoAgentState.lastInsight = {
                title: "SEO Forecast",
                summary: "Traffic " + forecast.currentTraffic + " -> " + forecast.projectedTraffic + " · confidence " + forecast.confidence
            };
        }

        saveSeoForecastState(forecast);

        summary = "Traffic " + forecast.currentTraffic + " -> " + forecast.projectedTraffic +
            " · Leads " + forecast.currentLeads + " -> " + forecast.projectedLeads +
            " · Rank #" + forecast.currentRank + " -> #" + forecast.projectedRank +
            " · " + forecast.estimatedMonths + " months · " + forecast.confidence;

        if (typeof global.sendAgentMessage === "function") {
            try {
                global.sendAgentMessage("SEO", "EXECUTIVE", "SEO FORECAST CREATED: " + summary, "UPDATE", "HIGH");
            } catch (err) {
                /* skip safely */
            }
        }

        if (typeof global.recordProjectEvent === "function") {
            try {
                global.recordProjectEvent("SEO_FORECAST_CREATED", forecast);
            } catch (err) {
                /* skip safely */
            }
        }

        return forecast;
    }

    function getSeoForecastSummary() {
        var memory = typeof global.loadExecutiveMemory === "function" ? global.loadExecutiveMemory() : null;
        var forecast = memory ? ensureSeoForecastStore(memory) : null;
        var hasData = forecast && (forecast.currentTraffic || forecast.projectedTraffic || forecast.currentRank);

        return {
            forecastTraffic: hasData
                ? String(forecast.currentTraffic || 0) + " -> " + String(forecast.projectedTraffic || 0)
                : "0 -> 0",
            forecastLeads: hasData
                ? String(forecast.currentLeads || 0) + " -> " + String(forecast.projectedLeads || 0)
                : "0 -> 0",
            forecastRevenue: hasData
                ? formatCurrency(forecast.currentRevenue) + " -> " + formatCurrency(forecast.projectedRevenue)
                : "$0 -> $0",
            forecastRank: hasData
                ? "#" + String(forecast.currentRank || 0) + " -> #" + String(forecast.projectedRank || 0)
                : "#0 -> #0",
            forecastConfidence: forecast ? (forecast.confidence || "LOW") : "LOW",
            forecastTimeline: forecast ? String(forecast.estimatedMonths || 0) + " months" : "0 months",
            forecastRisk: forecast && forecast.confidence === "HIGH"
                ? "LOW"
                : (forecast && forecast.confidence === "MEDIUM" ? "MEDIUM" : "HIGH"),
            seoForecastStatus: hasData
                ? "Traffic: " + forecast.currentTraffic + " -> " + forecast.projectedTraffic +
                    " · Leads: " + forecast.currentLeads + " -> " + forecast.projectedLeads +
                    " · Revenue: " + formatCurrency(forecast.currentRevenue) + " -> " + formatCurrency(forecast.projectedRevenue) +
                    " · Rank: #" + forecast.currentRank + " -> #" + forecast.projectedRank +
                    " · Timeline: " + forecast.estimatedMonths + " months · Confidence: " + forecast.confidence
                : "Traffic: 0 -> 0 · Leads: 0 -> 0 · Revenue: $0 -> $0 · Rank: #0 -> #0 · Timeline: 0 months · Confidence: LOW",
            lastUpdated: forecast ? forecast.lastUpdated : null
        };
    }

    function renderSeoForecastCard() {
        var summary = getSeoForecastSummary();
        var escapeHtml = typeof global.assignmentEscapeHtml === "function"
            ? global.assignmentEscapeHtml
            : function(value) { return String(value); };

        return "SEO Forecast Status:\n" +
            "Traffic: " + escapeHtml(summary.forecastTraffic) + "\n" +
            "Leads: " + escapeHtml(summary.forecastLeads) + "\n" +
            "Revenue: " + escapeHtml(summary.forecastRevenue) + "\n" +
            "Rank: " + escapeHtml(summary.forecastRank) + "\n" +
            "Timeline: " + escapeHtml(summary.forecastTimeline) + "\n" +
            "Confidence: " + escapeHtml(summary.forecastConfidence);
    }

    function getSeoForecastDashboardCardHtml() {
        var summary = getSeoForecastSummary();
        var escapeHtml = typeof global.assignmentEscapeHtml === "function"
            ? global.assignmentEscapeHtml
            : function(value) { return String(value); };

        return "Forecast Traffic: " + escapeHtml(summary.forecastTraffic) + "\n" +
            "Forecast Leads: " + escapeHtml(summary.forecastLeads) + "\n" +
            "Forecast Revenue: " + escapeHtml(summary.forecastRevenue) + "\n" +
            "Forecast Rank: " + escapeHtml(summary.forecastRank) + "\n" +
            "Forecast Timeline: " + escapeHtml(summary.forecastTimeline) + "\n" +
            "Forecast Confidence: " + escapeHtml(summary.forecastConfidence);
    }

    function bindSeoForecastButtons() {
        var panel = global.executiveAgentCommandCenterContent;
        var sprint;

        if (!panel || panel.dataset.seoProjectionForecastBound === "true") {
            return;
        }

        panel.dataset.seoProjectionForecastBound = "true";
        panel.addEventListener("click", function(event) {
            var target = event.target;

            if (!target || !target.id) {
                return;
            }

            sprint = typeof global.getOrchestratorSprint === "function" ? global.getOrchestratorSprint() : null;

            if (target.id === "seoAgentForecastTrafficBtn") {
                forecastTrafficGrowth();
            } else if (target.id === "seoAgentForecastLeadsBtn") {
                forecastLeadGrowth();
            } else if (target.id === "seoAgentForecastRevenueBtn") {
                forecastRevenueGrowth();
            } else if (target.id === "seoAgentForecastRankingsBtn") {
                forecastRankImprovement();
            } else if (target.id === "seoAgentGenerateSeoForecastBtn") {
                generateSeoForecast();
            } else {
                return;
            }

            if (typeof global.refreshExecutiveAgentCommandViews === "function") {
                global.refreshExecutiveAgentCommandViews(sprint);
            }

            if (typeof global.renderExecutiveRuntimeDashboard === "function") {
                global.renderExecutiveRuntimeDashboard(sprint);
            }
        });
    }

    global.ensureSeoForecastStore = ensureSeoForecastStore;
    global.saveSeoForecastState = saveSeoForecastState;
    global.forecastTrafficGrowth = forecastTrafficGrowth;
    global.forecastLeadGrowth = forecastLeadGrowth;
    global.forecastRevenueGrowth = forecastRevenueGrowth;
    global.forecastRankImprovement = forecastRankImprovement;
    global.forecastTimeToResults = forecastTimeToResults;
    global.calculateForecastConfidence = calculateForecastConfidence;
    global.generateSeoForecast = generateSeoForecast;
    global.getSeoForecastSummary = getSeoForecastSummary;
    global.renderSeoForecastCard = renderSeoForecastCard;
    global.getSeoForecastDashboardCardHtml = getSeoForecastDashboardCardHtml;
    global.bindSeoForecastButtons = bindSeoForecastButtons;
})(typeof window !== "undefined" ? window : globalThis);
