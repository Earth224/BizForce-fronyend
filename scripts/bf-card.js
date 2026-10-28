/* ══════════════════════════════════════════════════════════════════════════
   BF CARD — one place for what a business card hands to the world: the URL
   its QR encodes, its tap-to-call and tap-to-email links, and its vCard.
   card-view.html (the public card) and digital-cards.html (the editor) both
   load this file, so the two can never disagree.

   THE QR ENCODES THE CARD'S PUBLIC URL, not a vCard. Scanning opens the live
   card, which always says what the card says now; a vCard baked into a
   printed QR went stale the day a phone number changed, and could not carry
   a photo. The URL is the short link bizforceai.net/c/<slug> when the card
   has one, else card-view.html?token=<share token> (server.js cardPublicUrl
   builds the same).

   THE vCARD is version 3.0 with N, FN, ORG, TITLE, TEL, EMAIL, URL and PHOTO.
   Text values are escaped (backslash, comma, semicolon, newline), lines end
   in CRLF and are folded at 75 octets, as RFC 2426 asks. The PHOTO is the
   member's profile photo: embedded as base64 when the image is a JPEG, PNG
   or GIF of at most PHOTO_EMBED_MAX_BYTES, linked by URL otherwise (and when
   it cannot be fetched). The public card's fields arrive already filtered by
   the server: a field the member hid is "" there, so it is in neither the
   page, its links nor this vCard.
   ══════════════════════════════════════════════════════════════════════════ */
(function (root) {
  "use strict";

  var SITE = "https://bizforceai.net";
  var PHOTO_EMBED_MAX_BYTES = 96 * 1024;
  var PHOTO_TYPES = { "image/jpeg": "JPEG", "image/png": "PNG", "image/gif": "GIF" };

  function publicUrl(card) {
    if (card && card.public_url) return String(card.public_url);
    if (card && card.slug) return SITE + "/c/" + card.slug;
    if (card && card.share_token) return SITE + "/card-view.html?token=" + encodeURIComponent(card.share_token);
    return null;
  }

  /* tel: keeps a leading + and the digits; anything shorter than 3 digits is no number. */
  function telHref(phone) {
    var raw = String(phone || "").trim();
    var digits = raw.replace(/[^0-9]/g, "");
    if (digits.length < 3) return null;
    return "tel:" + (raw.charAt(0) === "+" ? "+" : "") + digits;
  }

  function mailtoHref(email) {
    var e = String(email || "").trim();
    if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(e)) return null;
    return "mailto:" + e;
  }

  function esc(value) {
    return String(value == null ? "" : value)
      .replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  }

  /* Folds one content line at 75 octets (UTF-8), continuation lines starting with a space. */
  function fold(line) {
    var out = [], cur = "", curBytes = 0, limit = 75;
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      var code = line.charCodeAt(i);
      if (code >= 0xd800 && code <= 0xdbff && i + 1 < line.length) { ch += line.charAt(++i); }
      var b = unescape(encodeURIComponent(ch)).length;
      if (curBytes + b > limit) { out.push(cur); cur = " "; curBytes = 1; limit = 75; }
      cur += ch; curBytes += b;
    }
    out.push(cur);
    return out.join("\r\n");
  }

  /* N is family;given — the last word of the name is taken as the family name. */
  function nameParts(full) {
    var words = String(full || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return { family: "", given: "" };
    if (words.length === 1) return { family: "", given: words[0] };
    return { family: words[words.length - 1], given: words.slice(0, -1).join(" ") };
  }

  /* card: { full_name, job_title, company, phone, email, website, public_url }.
     photo: null, { url } (linked) or { type: "JPEG", base64 } (embedded). */
  function buildVCard(card, photo) {
    var c = card || {};
    var n = nameParts(c.full_name);
    var lines = ["BEGIN:VCARD", "VERSION:3.0",
      "N:" + esc(n.family) + ";" + esc(n.given) + ";;;",
      "FN:" + esc(c.full_name || c.company || "Contact")];
    if (c.company) lines.push("ORG:" + esc(c.company));
    if (c.job_title) lines.push("TITLE:" + esc(c.job_title));
    var tel = telHref(c.phone);
    if (tel) lines.push("TEL;TYPE=WORK,VOICE:" + tel.slice(4));
    var mail = mailtoHref(c.email);
    if (mail) lines.push("EMAIL;TYPE=INTERNET:" + mail.slice(7));
    if (c.website) lines.push("URL:" + String(c.website).trim());
    var card_url = publicUrl(c);
    if (card_url && card_url !== String(c.website || "").trim()) lines.push("URL:" + card_url);
    if (photo && photo.base64 && photo.type) lines.push("PHOTO;ENCODING=b;TYPE=" + photo.type + ":" + photo.base64);
    else if (photo && photo.url) lines.push("PHOTO;VALUE=uri:" + photo.url);
    lines.push("END:VCARD");
    return lines.map(fold).join("\r\n") + "\r\n";
  }

  /* Resolves to the PHOTO for a photo URL: embedded when it can be fetched and is
     small enough, linked otherwise. Never rejects. */
  function photoFor(url, fetchImpl) {
    if (!url || !/^https:\/\//.test(url)) return Promise.resolve(null);
    var f = fetchImpl || (root.fetch && root.fetch.bind(root));
    var linked = { url: url };
    if (!f) return Promise.resolve(linked);
    return f(url).then(function (res) {
      if (!res.ok) return linked;
      return res.blob().then(function (blob) {
        var type = PHOTO_TYPES[String(blob.type || "").toLowerCase()];
        if (!type || blob.size > PHOTO_EMBED_MAX_BYTES) return linked;
        return blob.arrayBuffer().then(function (buf) {
          var bytes = new Uint8Array(buf), bin = "";
          for (var i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
          return { type: type, base64: root.btoa(bin) };
        });
      });
    }).catch(function () { return linked; });
  }

  root.bfCard = {
    SITE: SITE, PHOTO_EMBED_MAX_BYTES: PHOTO_EMBED_MAX_BYTES,
    publicUrl: publicUrl, telHref: telHref, mailtoHref: mailtoHref,
    vcardEscape: esc, fold: fold, buildVCard: buildVCard, photoFor: photoFor
  };
})(typeof window !== "undefined" ? window : this);
