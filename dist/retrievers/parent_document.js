import * as uuid from "uuid";
import { BaseRetriever } from "../schema/retriever.js";
import { Document } from "../document.js";
// TODO: Change this to subclass MultiVectorRetriever
/**
 * A type of document retriever that splits input documents into smaller chunks
 * while separately storing and preserving the original documents.
 * The small chunks are embedded, then on retrieval, the original
 * "parent" documents are retrieved.
 *
 * This strikes a balance between better targeted retrieval with small documents
 * and the more context-rich larger documents.
 */
export class ParentDocumentRetriever extends BaseRetriever {
    static lc_name() {
        return "ParentDocumentRetriever";
    }
    constructor(fields) {
        super(fields);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "retrievers", "parent_document"]
        });
        Object.defineProperty(this, "vectorstore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "docstore", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "childSplitter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "parentSplitter", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "idKey", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: "doc_id"
        });
        Object.defineProperty(this, "childK", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "parentK", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.vectorstore = fields.vectorstore;
        this.docstore = fields.docstore;
        this.childSplitter = fields.childSplitter;
        this.parentSplitter = fields.parentSplitter;
        this.idKey = fields.idKey ?? this.idKey;
        this.childK = fields.childK;
        this.parentK = fields.parentK;
    }
    async _getRelevantDocuments(query) {
        const subDocs = await this.vectorstore.similaritySearch(query, this.childK);
        // Maintain order
        const parentDocIds = [];
        for (const doc of subDocs) {
            if (!parentDocIds.includes(doc.metadata[this.idKey])) {
                parentDocIds.push(doc.metadata[this.idKey]);
            }
        }
        const parentDocs = [];
        for (const parentDocId of parentDocIds) {
            const parentDoc = await this.docstore.search(parentDocId);
            if (parentDoc !== undefined) {
                parentDocs.push(parentDoc);
            }
        }
        return parentDocs.slice(0, this.parentK);
    }
    /**
     * Adds documents to the docstore and vectorstores.
     * @param docs The documents to add
     * @param config.ids Optional list of ids for documents. If provided should be the same
     *   length as the list of documents. Can provided if parent documents
     *   are already in the document store and you don't want to re-add
     *   to the docstore. If not provided, random UUIDs will be used as ids.
     * @param config.addToDocstore Boolean of whether to add documents to docstore.
     * This can be false if and only if `ids` are provided. You may want
     *   to set this to False if the documents are already in the docstore
     *   and you don't want to re-add them.
     */
    async addDocuments(docs, config) {
        const { ids, addToDocstore = true } = config ?? {};
        const parentDocs = this.parentSplitter
            ? await this.parentSplitter.splitDocuments(docs)
            : docs;
        let parentDocIds;
        if (ids === undefined) {
            if (!addToDocstore) {
                throw new Error(`If ids are not passed in, "config.addToDocstore" MUST be true`);
            }
            parentDocIds = parentDocs.map((_doc) => uuid.v4());
        }
        else {
            parentDocIds = ids;
        }
        if (parentDocs.length !== parentDocIds.length) {
            throw new Error(`Got uneven list of documents and ids.\nIf "ids" is provided, should be same length as "documents".`);
        }
        const embeddedDocs = [];
        const fullDocs = {};
        for (let i = 0; i < parentDocs.length; i += 1) {
            const parentDoc = parentDocs[i];
            const parentDocId = parentDocIds[i];
            const subDocs = await this.childSplitter.splitDocuments([parentDoc]);
            const taggedSubDocs = subDocs.map((subDoc) => new Document({
                pageContent: subDoc.pageContent,
                metadata: { ...subDoc.metadata, [this.idKey]: parentDocId },
            }));
            embeddedDocs.push(...taggedSubDocs);
            fullDocs[parentDocId] = parentDoc;
        }
        await this.vectorstore.addDocuments(embeddedDocs);
        if (addToDocstore) {
            await this.docstore.add(fullDocs);
        }
    }
}
