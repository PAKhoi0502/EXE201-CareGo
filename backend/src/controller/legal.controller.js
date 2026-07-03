import { getLegalDocumentBySlug, getLegalRequirements } from "../legal/legal-documents.js";

const serializeDocument = (document, includeContent = false) => ({
  type: document.type,
  slug: document.slug,
  audience: document.audience,
  version: document.version,
  title: document.title,
  summary: document.summary,
  hash: document.hash,
  ...(includeContent ? { sections: document.sections } : {}),
});

export const getLegalRequirementsByFlow = (req, res) => {
  const flow = String(req.params.flow || "").trim().toUpperCase();
  const documents = getLegalRequirements(flow);
  if (!documents.length) {
    return res.status(404).json({ message: "Không tìm thấy yêu cầu pháp lý cho luồng này." });
  }

  return res.status(200).json({
    flow,
    documents: documents.map((document) => serializeDocument(document)),
  });
};

export const getLegalDocument = (req, res) => {
  const document = getLegalDocumentBySlug(String(req.params.slug || "").trim().toLowerCase());
  if (!document) {
    return res.status(404).json({ message: "Không tìm thấy tài liệu pháp lý." });
  }

  return res.status(200).json({ document: serializeDocument(document, true) });
};
