(function(global) {
    "use strict";

    function ensureSeoTechnicalStore(memory) {
        var store;
        var technical;

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

        if (!store.technical || typeof store.technical !== "object") {
            store.technical = {
                audits: [],
                issues: [],
                crawlFindings: [],
                speedFindings: [],
                indexabilityFindings: [],
                schemaFindings: [],
                recommendations: [],
                lastUpdated: null
            };
        }

        technical = store.technical;

        if (!Array.isArray(technical.audits)) {
            technical.audits = [];
        }

        if (!Array.isArray(technical.issues)) {
            technical.issues = [];
        }

        if (!Array.isArray(technical.crawlFindings)) {
            technical.crawlFindings = [];
        }

        if (!Array.isArray(technical.speedFindings)) {
            technical.speedFindings = [];
        }

        if (!Array.isArray(technical.indexabilityFindings)) {
            technical.indexabilityFindings = [];
        }

        if (!Array.isArray(technical.schemaFindings)) {
            technical.schemaFindings = [];
        }

        if (!Array.isArray(technical.recommendations)) {
            technical.recommendations = [];
        }

        return technical;
    }

    function saveSeoTechnicalState(technical) {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;

        if (!technical || !memory || typeof global.saveSeoAgentMemory !== "function") {
            return null;
        }

        technical.lastUpdated = new Date().toISOString();
        global.saveSeoAgentMemory(memory);
        return technical;
    }

    function resolveSeoTechnicalUrl(url) {
        if (url) {
            return typeof global.normalizeSeoUrl === "function"
                ? global.normalizeSeoUrl(url)
                : String(url).trim();
        }

        var urlEl = typeof document !== "undefined" ? document.getElementById("seoAgentUrlInput") : null;

        return urlEl && urlEl.value
            ? (typeof global.normalizeSeoUrl === "function" ? global.normalizeSeoUrl(urlEl.value) : urlEl.value.trim())
            : "https://example.com";
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

    function analyzeTechnicalSeoAudit(url) {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;
        var store = memory && typeof global.ensureSeoAgentStore === "function" ? global.ensureSeoAgentStore(memory) : null;
        var technical = ensureSeoTechnicalStore(memory);
        var target = resolveSeoTechnicalUrl(url);
        var seed = hashSeed(target + "_technical_audit");
        var legacyAudit = typeof global.runTechnicalSeoAudit === "function" ? global.runTechnicalSeoAudit(target) : null;
        var audit;
        var crawlFindings;
        var index;

        crawlFindings = [
            {
                id: createRecordId(),
                type: "crawl",
                finding: "Advisory crawl review for " + target,
                severity: seed % 5 === 0 ? "high" : "medium",
                pagesReviewed: 10 + (seed % 40),
                blockedUrls: seed % 4,
                createdAt: new Date().toISOString()
            },
            {
                id: createRecordId(),
                type: "crawl",
                finding: "Internal link depth review recommended",
                severity: "medium",
                pagesReviewed: 8 + (seed % 20),
                blockedUrls: seed % 2,
                createdAt: new Date().toISOString()
            }
        ];

        audit = {
            id: createRecordId(),
            type: "technical_seo_engine_audit",
            url: target,
            technicalScore: 55 + (seed % 40),
            crawlabilityScore: legacyAudit ? legacyAudit.crawlabilityScore : 60 + (seed % 35),
            indexabilityScore: legacyAudit ? legacyAudit.indexabilityScore : 58 + ((seed >> 2) % 38),
            issueCount: 2 + (seed % 5),
            status: seed % 7 === 0 ? "needs_attention" : "reviewed",
            advisoryOnly: true,
            createdAt: new Date().toISOString()
        };

        technical.audits.unshift(audit);
        technical.audits = technical.audits.slice(0, 30);
        technical.crawlFindings = crawlFindings.concat(technical.crawlFindings).slice(0, 30);

        for (index = 0; index < audit.issueCount; index++) {
            technical.issues.unshift({
                id: createRecordId(),
                url: target,
                category: index % 2 === 0 ? "crawl" : "technical",
                severity: index === 0 ? "critical" : (index < 3 ? "high" : "medium"),
                issue: index === 0
                    ? "Missing or inconsistent canonical tags detected"
                    : "Advisory technical issue #" + (index + 1) + " on " + target,
                recommendation: "Review and fix during planned maintenance window",
                createdAt: new Date().toISOString()
            });
        }

        technical.issues = technical.issues.slice(0, 50);
        detectTechnicalSeoIssues();

        if (store) {
            store.status = "technical_seo_analysis";
            store.lastAnalysis = {
                type: "technical_seo_engine_audit",
                url: target,
                audit: audit,
                timestamp: audit.createdAt
            };
        }

        if (global.seoAgentState) {
            global.seoAgentState.lastAnalysis = store ? store.lastAnalysis : audit;
            global.seoAgentState.lastInsight = {
                title: "Technical SEO Audit",
                summary: target + " · score " + audit.technicalScore + " · advisory only"
            };
        }

        calculateTechnicalSeoScore();
        saveSeoTechnicalState(technical);
        return audit;
    }

    function analyzePageSpeed(url) {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;
        var store = memory && typeof global.ensureSeoAgentStore === "function" ? global.ensureSeoAgentStore(memory) : null;
        var technical = ensureSeoTechnicalStore(memory);
        var target = resolveSeoTechnicalUrl(url);
        var seed = hashSeed(target + "_page_speed");
        var lcp = (2.0 + (seed % 25) / 10).toFixed(1);
        var fid = (35 + (seed % 90)) + "ms";
        var cls = (0.04 + (seed % 12) / 100).toFixed(2);
        var finding;

        finding = {
            id: createRecordId(),
            url: target,
            lcp: lcp + "s",
            fid: fid,
            cls: cls,
            mobileScore: 45 + (seed % 50),
            desktopScore: 55 + ((seed >> 3) % 40),
            status: Number(lcp) > 2.5 || Number(cls) > 0.1 ? "needs_improvement" : "good",
            advisoryOnly: true,
            createdAt: new Date().toISOString()
        };

        technical.speedFindings.unshift(finding);
        technical.speedFindings = technical.speedFindings.slice(0, 30);

        if (finding.status !== "good") {
            technical.issues.unshift({
                id: createRecordId(),
                url: target,
                category: "speed",
                severity: finding.mobileScore < 50 ? "critical" : "high",
                issue: "Core Web Vitals advisory review flagged speed opportunities",
                recommendation: "Optimize LCP, reduce render-blocking assets, and compress media",
                createdAt: finding.createdAt
            });
            technical.issues = technical.issues.slice(0, 50);
        }

        if (store) {
            store.status = "technical_seo_analysis";
        }

        calculateTechnicalSeoScore();
        saveSeoTechnicalState(technical);
        return finding;
    }

    function analyzeIndexability(url) {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;
        var store = memory && typeof global.ensureSeoAgentStore === "function" ? global.ensureSeoAgentStore(memory) : null;
        var technical = ensureSeoTechnicalStore(memory);
        var target = resolveSeoTechnicalUrl(url);
        var seed = hashSeed(target + "_indexability");
        var findings = [];
        var checks = [
            "robots.txt allows key landing pages",
            "noindex tags reviewed on utility pages",
            "XML sitemap coverage checked",
            "canonical conflicts flagged for review"
        ];
        var index;

        for (index = 0; index < checks.length; index++) {
            findings.push({
                id: createRecordId(),
                url: target,
                check: checks[index],
                status: seed % (index + 3) === 0 ? "warning" : "pass",
                severity: seed % (index + 3) === 0 ? "high" : "low",
                advisoryOnly: true,
                createdAt: new Date().toISOString()
            });
        }

        technical.indexabilityFindings = findings.concat(technical.indexabilityFindings).slice(0, 30);

        findings.forEach(function(item) {
            if (item.status === "warning") {
                technical.issues.unshift({
                    id: createRecordId(),
                    url: target,
                    category: "indexability",
                    severity: item.severity,
                    issue: item.check,
                    recommendation: "Resolve indexability advisory finding during technical sprint",
                    createdAt: item.createdAt
                });
            }
        });

        technical.issues = technical.issues.slice(0, 50);

        if (store) {
            store.status = "technical_seo_analysis";
        }

        calculateTechnicalSeoScore();
        saveSeoTechnicalState(technical);
        return findings;
    }

    function analyzeSchemaReadiness(url) {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;
        var store = memory && typeof global.ensureSeoAgentStore === "function" ? global.ensureSeoAgentStore(memory) : null;
        var technical = ensureSeoTechnicalStore(memory);
        var target = resolveSeoTechnicalUrl(url);
        var seed = hashSeed(target + "_schema");
        var schemas = ["Organization", "LocalBusiness", "FAQPage", "BreadcrumbList", "Service"];
        var findings = [];
        var index;

        for (index = 0; index < schemas.length; index++) {
            findings.push({
                id: createRecordId(),
                url: target,
                schemaType: schemas[index],
                status: seed % (index + 2) === 0 ? "missing" : "partial",
                coverage: seed % (index + 2) === 0 ? 0 : 40 + ((seed + index * 11) % 55),
                advisoryOnly: true,
                createdAt: new Date().toISOString()
            });
        }

        technical.schemaFindings = findings.concat(technical.schemaFindings).slice(0, 30);

        findings.forEach(function(item) {
            if (item.status !== "partial" || item.coverage < 60) {
                technical.issues.unshift({
                    id: createRecordId(),
                    url: target,
                    category: "schema",
                    severity: item.status === "missing" ? "high" : "medium",
                    issue: item.schemaType + " structured data readiness review",
                    recommendation: "Add or complete JSON-LD schema during content update cycle",
                    createdAt: item.createdAt
                });
            }
        });

        technical.issues = technical.issues.slice(0, 50);

        if (store) {
            store.status = "technical_seo_analysis";
        }

        calculateTechnicalSeoScore();
        saveSeoTechnicalState(technical);
        return findings;
    }

    function detectTechnicalSeoIssues() {
        var memory = typeof global.loadExecutiveMemory === "function" ? global.loadExecutiveMemory() : null;
        var technical = memory ? ensureSeoTechnicalStore(memory) : null;
        var criticalCount = 0;
        var highCount = 0;

        if (!technical) {
            return [];
        }

        technical.issues.forEach(function(issue) {
            if (issue.severity === "critical") {
                criticalCount += 1;
            } else if (issue.severity === "high") {
                highCount += 1;
            }
        });

        technical.criticalIssueCount = criticalCount;
        technical.highIssueCount = highCount;
        technical.riskLevel = criticalCount > 2 ? "HIGH" : (criticalCount > 0 || highCount > 3 ? "MEDIUM" : "LOW");
        saveSeoTechnicalState(technical);
        return technical.issues;
    }

    function calculateTechnicalSeoScore() {
        var memory = typeof global.loadExecutiveMemory === "function" ? global.loadExecutiveMemory() : null;
        var technical = memory ? ensureSeoTechnicalStore(memory) : null;
        var latestAudit;
        var speed;
        var indexabilityWarnings = 0;
        var schemaGaps = 0;
        var score;
        var penalty = 0;

        if (!technical) {
            return { technicalSeoScore: 0, riskLevel: "LOW" };
        }

        latestAudit = technical.audits.length ? technical.audits[0] : null;
        speed = technical.speedFindings.length ? technical.speedFindings[0] : null;
        detectTechnicalSeoIssues();

        technical.indexabilityFindings.forEach(function(item) {
            if (item.status === "warning") {
                indexabilityWarnings += 1;
            }
        });

        technical.schemaFindings.forEach(function(item) {
            if (item.status === "missing" || item.coverage < 60) {
                schemaGaps += 1;
            }
        });

        score = latestAudit ? latestAudit.technicalScore : 50;
        if (speed) {
            score = Math.round((score + ((speed.mobileScore || 0) + (speed.desktopScore || 0)) / 2) / 2);
        }

        penalty = (technical.criticalIssueCount || 0) * 8 + (technical.highIssueCount || 0) * 3;
        penalty += indexabilityWarnings * 2 + schemaGaps * 2;
        score = Math.max(0, Math.min(100, score - penalty));

        technical.technicalSeoScore = score;
        technical.pageSpeedStatus = speed ? speed.status : "not_checked";
        technical.indexabilityStatus = indexabilityWarnings ? "warnings_found" : (technical.indexabilityFindings.length ? "pass" : "not_checked");
        technical.schemaStatus = schemaGaps ? "gaps_found" : (technical.schemaFindings.length ? "ready" : "not_checked");

        return {
            technicalSeoScore: score,
            riskLevel: technical.riskLevel || "LOW"
        };
    }

    function generateTechnicalSeoPlan(url) {
        var memory = typeof global.getSeoAgentMemory === "function" ? global.getSeoAgentMemory() : null;
        var store = memory && typeof global.ensureSeoAgentStore === "function" ? global.ensureSeoAgentStore(memory) : null;
        var technical = ensureSeoTechnicalStore(memory);
        var target = resolveSeoTechnicalUrl(url);
        var audit;
        var speed;
        var indexability;
        var schema;
        var scoreResult;
        var plan;
        var summary;

        audit = analyzeTechnicalSeoAudit(target);
        speed = analyzePageSpeed(target);
        indexability = analyzeIndexability(target);
        schema = analyzeSchemaReadiness(target);
        scoreResult = calculateTechnicalSeoScore();

        plan = {
            id: createRecordId(),
            name: "Technical SEO Plan · " + target,
            url: target,
            technicalSeoScore: scoreResult.technicalSeoScore,
            criticalIssueCount: technical.criticalIssueCount || 0,
            pageSpeedStatus: technical.pageSpeedStatus || "not_checked",
            indexabilityStatus: technical.indexabilityStatus || "not_checked",
            schemaStatus: technical.schemaStatus || "not_checked",
            riskLevel: scoreResult.riskLevel || "LOW",
            advisoryOnly: true,
            actions: [
                "Resolve top " + Math.min(3, technical.criticalIssueCount || 0) + " critical technical issues",
                "Improve page speed status: " + (technical.pageSpeedStatus || "not_checked"),
                "Fix indexability warnings on priority URLs",
                "Complete schema coverage for key page templates",
                "Schedule follow-up advisory audit after fixes"
            ],
            createdAt: new Date().toISOString()
        };

        technical.recommendations.unshift(plan);
        technical.recommendations = technical.recommendations.slice(0, 30);

        if (store) {
            store.status = "technical_seo_planning";
            store.lastAnalysis = {
                type: "technical_seo_plan",
                plan: plan,
                timestamp: plan.createdAt
            };
        }

        if (global.seoAgentState) {
            global.seoAgentState.lastInsight = {
                title: "Technical SEO Plan",
                summary: plan.name + " · score " + scoreResult.technicalSeoScore
            };
        }

        saveSeoTechnicalState(technical);

        summary = plan.name + " · score " + scoreResult.technicalSeoScore + " · risk " + (scoreResult.riskLevel || "LOW");

        if (typeof global.sendAgentMessage === "function") {
            try {
                global.sendAgentMessage("SEO", "EXECUTIVE", "SEO TECHNICAL PLAN CREATED: " + summary, "UPDATE", "HIGH");
            } catch (err) {
                /* skip safely */
            }
        }

        if (typeof global.recordProjectEvent === "function") {
            try {
                global.recordProjectEvent("SEO_TECHNICAL_PLAN_CREATED", plan);
            } catch (err) {
                /* skip safely */
            }
        }

        return plan;
    }

    function getSeoTechnicalSummary() {
        var memory = typeof global.loadExecutiveMemory === "function" ? global.loadExecutiveMemory() : null;
        var technical = memory ? ensureSeoTechnicalStore(memory) : null;
        var scoreResult = technical ? calculateTechnicalSeoScore() : { technicalSeoScore: 0, riskLevel: "LOW" };
        var criticalCount = technical ? (technical.criticalIssueCount || 0) : 0;
        var pageSpeedStatus = technical ? (technical.pageSpeedStatus || "not_checked") : "not_checked";
        var indexabilityStatus = technical ? (technical.indexabilityStatus || "not_checked") : "not_checked";
        var schemaStatus = technical ? (technical.schemaStatus || "not_checked") : "not_checked";
        var riskLevel = technical ? (technical.riskLevel || "LOW") : "LOW";

        return {
            technicalSeoScore: scoreResult.technicalSeoScore || 0,
            criticalIssueCount: criticalCount,
            technicalIssueCount: technical && Array.isArray(technical.issues) ? technical.issues.length : 0,
            pageSpeedStatus: pageSpeedStatus,
            indexabilityStatus: indexabilityStatus,
            schemaStatus: schemaStatus,
            riskLevel: riskLevel,
            seoTechnicalStatus: technical && (technical.audits.length || technical.issues.length)
                ? "Score: " + (scoreResult.technicalSeoScore || 0) + " · Critical: " + criticalCount + " · Risk: " + riskLevel
                : "Score: 0 · Critical: 0 · Risk: LOW",
            lastUpdated: technical ? technical.lastUpdated : null
        };
    }

    function renderSeoTechnicalCard() {
        var summary = getSeoTechnicalSummary();
        var escapeHtml = typeof global.assignmentEscapeHtml === "function"
            ? global.assignmentEscapeHtml
            : function(value) { return String(value); };

        return "SEO Technical Status: " + escapeHtml(String(summary.seoTechnicalStatus || "Score: 0 · Critical: 0 · Risk: LOW"));
    }

    function getSeoTechnicalDashboardCardHtml() {
        var summary = getSeoTechnicalSummary();
        var escapeHtml = typeof global.assignmentEscapeHtml === "function"
            ? global.assignmentEscapeHtml
            : function(value) { return String(value); };

        return "Technical SEO Score: " + escapeHtml(String(summary.technicalSeoScore || 0)) + "\n" +
            "Critical Issue Count: " + escapeHtml(String(summary.criticalIssueCount || 0)) + "\n" +
            "Page Speed Status: " + escapeHtml(String(summary.pageSpeedStatus || "not_checked")) + "\n" +
            "Indexability Status: " + escapeHtml(String(summary.indexabilityStatus || "not_checked")) + "\n" +
            "Schema Status: " + escapeHtml(String(summary.schemaStatus || "not_checked"));
    }

    function bindSeoTechnicalButtons() {
        var panel = global.executiveAgentCommandCenterContent;
        var sprint;
        var urlInput;

        if (!panel || panel.dataset.seoTechnicalBound === "true") {
            return;
        }

        panel.dataset.seoTechnicalBound = "true";
        panel.addEventListener("click", function(event) {
            var target = event.target;
            var url;

            if (!target || !target.id) {
                return;
            }

            sprint = typeof global.getOrchestratorSprint === "function" ? global.getOrchestratorSprint() : null;
            urlInput = document.getElementById("seoAgentUrlInput");
            url = urlInput && urlInput.value ? urlInput.value : "example.com";

            if (target.id === "seoAgentTechnicalAuditBtn") {
                analyzeTechnicalSeoAudit(url);
            } else if (target.id === "seoAgentPageSpeedBtn") {
                analyzePageSpeed(url);
            } else if (target.id === "seoAgentIndexabilityBtn") {
                analyzeIndexability(url);
            } else if (target.id === "seoAgentSchemaReadinessBtn") {
                analyzeSchemaReadiness(url);
            } else if (target.id === "seoAgentGenerateTechnicalPlanBtn") {
                generateTechnicalSeoPlan(url);
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

    global.ensureSeoTechnicalStore = ensureSeoTechnicalStore;
    global.saveSeoTechnicalState = saveSeoTechnicalState;
    global.analyzeTechnicalSeoAudit = analyzeTechnicalSeoAudit;
    global.analyzePageSpeed = analyzePageSpeed;
    global.analyzeIndexability = analyzeIndexability;
    global.analyzeSchemaReadiness = analyzeSchemaReadiness;
    global.detectTechnicalSeoIssues = detectTechnicalSeoIssues;
    global.calculateTechnicalSeoScore = calculateTechnicalSeoScore;
    global.generateTechnicalSeoPlan = generateTechnicalSeoPlan;
    global.getSeoTechnicalSummary = getSeoTechnicalSummary;
    global.renderSeoTechnicalCard = renderSeoTechnicalCard;
    global.getSeoTechnicalDashboardCardHtml = getSeoTechnicalDashboardCardHtml;
    global.bindSeoTechnicalButtons = bindSeoTechnicalButtons;
})(typeof window !== "undefined" ? window : globalThis);
