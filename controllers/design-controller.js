// controllers/design-controller.js
const Design = require("../models/design-model");
const Product = require("../models/allproduct-model"); // optional if you link product
const PDFDocument = require("pdfkit");
const path = require("path");
/* =========================
   Helpers
========================= */
function csvEscape(val) {
  if (val == null) return "";
  const s = String(val);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toISODateOnly(d) {
  try {
    const iso = new Date(d).toISOString();
    // YYYY-MM-DD
    return iso.slice(0, 10);
  } catch {
    return "";
  }
}

/* =========================
   GET /api/designs?page=&limit=
   -> current user's designs
========================= */
async function listDesigns(req, res) {
  try {
    const page  = Math.max(1, Number(req.query.page)  || 1);
    const limit = Math.min(1000, Math.max(1, Number(req.query.limit) || 5));

    const { from, to, productName, q } = req.query || {};
    const filter = { userId: req.user.id };

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }

    if (productName) filter.productName = new RegExp(String(productName), "i");
    if (q) {
      filter.$or = [
        { productName: new RegExp(String(q), "i") },
        { "texts.content": new RegExp(String(q), "i") },
      ];
    }

    const [data, total] = await Promise.all([
      Design.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        // CHANGED: include productId so FE can add the right item to cart
        .select("designUrl productName productId createdAt imageUrls texts") // CHANGED
        .lean(),
      Design.countDocuments(filter),
    ]);

    res.json({ data, total, page, limit });
  } catch (err) {
    console.error("listDesigns error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

/* =========================
   POST /api/designs
   body: { designUrl, imageUrls[], texts[], productId?, productName? }
========================= */
async function createDesign(req, res) {
  try {
    const { designUrl, imageUrls = [], texts = [], productId, productName } = req.body || {};
    if (!designUrl) return res.status(400).json({ error: "designUrl is required" });

    // (Optional) accept business productId or mongo _id
    let mongoProductId = undefined;
    if (productId) {
      const byBusiness = await Product.findOne({ productId: productId })
        .select("_id")
        .lean()
        .catch(() => null);
      if (byBusiness?._id) mongoProductId = byBusiness._id;
      else mongoProductId = productId; // assume it's already a Mongo _id
    }

    const doc = await Design.create({
      userId: req.user.id, // ALWAYS mongo _id from token
      productId: mongoProductId,
      productName,
      designUrl,
      imageUrls: Array.isArray(imageUrls) ? imageUrls : [],
      texts: Array.isArray(texts) ? texts : [],
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("createDesign error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

/* =========================
   DELETE /api/designs/:id
========================= */
async function deleteDesign(req, res) {
  try {
    const d = await Design.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id,
    });
    if (!d) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    console.error("deleteDesign error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

// ===== Brand config (tweak to your palette / assets) =====
const BRAND = {
  dark: "#2F4B39",      // header background (deep green)
  light: "#FFFFFF",
  accent: "#F3C86A",    // gold divider
  text: "#1F2937",      // main body text
  subtext: "#6B7280",   // gray
};
const LOGO_PATH = path.join(__dirname, "..", "public", "icons", "logo.png");
// If you can’t serve files from controllers, you can switch to a URL:
// const LOGO_URL = "https://your-cdn/logo.png";

function fit(str, max = 120) {
  const s = (str ?? "").toString();
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

function fmtDT(d) {
  try { return new Date(d).toLocaleString(); } catch { return ""; }
}

async function exportDesignsPdf(req, res) {
  try {
    const { from, to, productName, q, sort = "-createdAt" } = req.query || {};
    const filter = { userId: req.user.id };

    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const end = new Date(to);
        end.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = end;
      }
    }
    if (productName) filter.productName = new RegExp(String(productName), "i");
    if (q) {
      filter.$or = [
        { productName: new RegExp(String(q), "i") },
        { "texts.content": new RegExp(String(q), "i") },
      ];
    }

    const rows = await Design.find(filter).sort(String(sort)).lean();

    // ------- Metrics -------
    const totalDesigns = rows.length;
    const totalImages = rows.reduce((a, d) => a + (Array.isArray(d.imageUrls) ? d.imageUrls.length : 0), 0);
    const totalTexts  = rows.reduce((a, d) => a + (Array.isArray(d.texts) ? d.texts.length : 0), 0);
    const lastCreated = rows.length ? new Date(Math.max(...rows.map(d => +new Date(d.createdAt)))) : null;

    // ------- PDF Setup -------
    const now = new Date();
    const dtFile =
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}_` +
      `${String(now.getHours()).padStart(2,"0")}-${String(now.getMinutes()).padStart(2,"0")}`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="designs-report-${dtFile}.pdf"`);

    const doc = new PDFDocument({ margin: 40, size: "A4" });
    doc.pipe(res);

    // ===== Header Bar (like your Account Summary) =====
    const headerH = 70;
    doc.rect(0, 0, doc.page.width, headerH).fill(BRAND.dark);

    // logo (optional)
    try {
      doc.image(LOGO_PATH, 40, 18, { fit: [36, 36] });
    } catch { /* ignore if not found */ }

    doc
      .fillColor(BRAND.light)
      .fontSize(20)
      .font("Helvetica-Bold")
      .text("VDU Intimates", 90, 18, { continued: false });

    doc
      .fontSize(12)
      .font("Helvetica")
      .text("Designs Report", 90, 42);

    // back to normal flow under header
    


    // ===== Designs Summary Section =====
    doc.moveDown(2);
    doc.fillColor(BRAND.text).font("Helvetica-Bold").fontSize(14).text("Designs Summary");
    doc.moveDown(0.4);
    doc.font("Helvetica").fontSize(11).fillColor(BRAND.text);

    const boxY = doc.y;
    const boxW = doc.page.width - 80;
    const boxH = 70;

    // soft card
    doc
      .roundedRect(40, boxY, boxW, boxH, 8)
      .lineWidth(0.5)
      .strokeColor("#E5E7EB")
      .stroke();

    // summary content inside card
    const pad = 14;
    let x = 40 + pad;
    let y = boxY + pad;
    const colW = boxW / 3;

    doc.font("Helvetica").fontSize(11).fillColor(BRAND.text);
    doc.text(`Total Designs : ${totalDesigns}`, x, y, { width: colW });
    doc.text(`Total Images  : ${totalImages}`, x, y + 18, { width: colW });
    doc.text(`Total Texts   : ${totalTexts}`,  x, y + 36, { width: colW });

    x += colW;
    doc.text(`Last Created  : ${lastCreated ? lastCreated.toLocaleString() : "—"}`, x, y, { width: colW });
    // add any other quick stats you like here

    // move cursor below card
    doc.y = boxY + boxH + 16;

    // ===== Table (NO image URLs) =====
    const columns = [
      { key: "id",     label: "Design ID",        width: 90 },
      { key: "product",label: "Product",          width: 100 },
      { key: "created",label: "Created At",       width: 130 },
      { key: "imgs",   label: "Images",           width: 55  },
      { key: "txts",   label: "Texts",            width: 50  },
      { key: "texts3", label: "First Text",    width: 100 },
    ];
    const startX = 40;
    const rowH = 20;
    const headerFill = "#EFE8D9";
    const textSize = 10;

    function drawRow(yRow, row, isHeader = false) {
      let cx = startX;
      doc.fontSize(textSize);
      for (const col of columns) {
        const cell = row[col.key] ?? "";
        if (isHeader) {
          doc.save().rect(cx, yRow - 13, col.width, rowH).fill(headerFill).restore();
          doc.font("Helvetica-Bold");
        } else {
          doc.font("Helvetica");
        }
        doc.fillColor(BRAND.text).text(fit(cell, 110), cx + 4, yRow - 10, {
          width: col.width - 8,
          align: "left",
        });
        cx += col.width;
      }
      if (!isHeader) {
        doc
          .strokeColor("#E5E7EB")
          .moveTo(startX, yRow + 6)
          .lineTo(startX + columns.reduce((a, c) => a + c.width, 0), yRow + 6)
          .stroke()
          .strokeColor(BRAND.text);
      }
    }

   // header row
let tableY = doc.y + 10;
drawRow(tableY, Object.fromEntries(columns.map(c => [c.key, c.label])), true);
tableY += rowH;

function ensurePage() {
  if (tableY > doc.page.height - 60) {
    doc.addPage();
    // redraw table header on new page
    tableY = 50;
    drawRow(tableY, Object.fromEntries(columns.map(c => [c.key, c.label])), true);
    tableY += rowH;
  }
}

for (const d of rows) {
  ensurePage();
  const texts3 = Array.isArray(d.texts)
    ? d.texts.slice(0, 1).map(t => (t?.content || "").trim()).filter(Boolean).join(" | ")
    : "";
  const rowObj = {
    id: (d._id && String(d._id).slice(0, 10)) || "",
    product: d.productName || "",
    created: d.createdAt ? fmtDT(d.createdAt) : "",
    imgs: Array.isArray(d.imageUrls) ? String(d.imageUrls.length) : "0",
    txts: Array.isArray(d.texts) ? String(d.texts.length) : "0",
    texts3,
  };
  drawRow(tableY, rowObj, false);
  tableY += rowH;
}

// footer
doc.moveDown(1.2);
doc.font("Helvetica-Bold").text(`Total designs: ${rows.length}`);
doc.end();
  } catch (err) {
    console.error("exportDesignsPdf (branded) error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = {
  listDesigns,
  createDesign,
  deleteDesign,
  exportDesignsPdf, // <--- NEW
};
