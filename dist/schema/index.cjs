"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Docstore = exports.BaseEntityStore = exports.BaseFileStore = exports.BaseCache = exports.BaseListChatMessageHistory = exports.BaseChatMessageHistory = exports.BasePromptValue = exports.ChatGenerationChunk = exports.ChatMessageChunk = exports.coerceMessageLikeToMessage = exports.isBaseMessage = exports.ChatMessage = exports.FunctionMessageChunk = exports.FunctionMessage = exports.SystemChatMessage = exports.AIChatMessage = exports.HumanChatMessage = exports.BaseChatMessage = exports.SystemMessageChunk = exports.SystemMessage = exports.AIMessageChunk = exports.AIMessage = exports.HumanMessageChunk = exports.HumanMessage = exports.BaseMessageChunk = exports.BaseMessage = exports.GenerationChunk = exports.RUN_KEY = void 0;
const serializable_js_1 = require("../load/serializable.cjs");
exports.RUN_KEY = "__run";
/**
 * Chunk of a single generation. Used for streaming.
 */
class GenerationChunk {
    constructor(fields) {
        Object.defineProperty(this, "text", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Object.defineProperty(this, "generationInfo", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.text = fields.text;
        this.generationInfo = fields.generationInfo;
    }
    concat(chunk) {
        return new GenerationChunk({
            text: this.text + chunk.text,
            generationInfo: {
                ...this.generationInfo,
                ...chunk.generationInfo,
            },
        });
    }
}
exports.GenerationChunk = GenerationChunk;
/**
 * Base class for all types of messages in a conversation. It includes
 * properties like `content`, `name`, and `additional_kwargs`. It also
 * includes methods like `toDict()` and `_getType()`.
 */
class BaseMessage extends serializable_js_1.Serializable {
    /**
     * @deprecated
     * Use {@link BaseMessage.content} instead.
     */
    get text() {
        return this.content;
    }
    constructor(fields, 
    /** @deprecated */
    kwargs) {
        if (typeof fields === "string") {
            // eslint-disable-next-line no-param-reassign
            fields = { content: fields, additional_kwargs: kwargs };
        }
        // Make sure the default value for additional_kwargs is passed into super() for serialization
        if (!fields.additional_kwargs) {
            // eslint-disable-next-line no-param-reassign
            fields.additional_kwargs = {};
        }
        super(fields);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "schema"]
        });
        Object.defineProperty(this, "lc_serializable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        /** The text of the message. */
        Object.defineProperty(this, "content", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** The name of the message sender in a multi-user chat. */
        Object.defineProperty(this, "name", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        /** Additional keyword arguments */
        Object.defineProperty(this, "additional_kwargs", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.name = fields.name;
        this.content = fields.content;
        this.additional_kwargs = fields.additional_kwargs;
    }
    toDict() {
        return {
            type: this._getType(),
            data: this.toJSON()
                .kwargs,
        };
    }
}
exports.BaseMessage = BaseMessage;
/**
 * Represents a chunk of a message, which can be concatenated with other
 * message chunks. It includes a method `_merge_kwargs_dict()` for merging
 * additional keyword arguments from another `BaseMessageChunk` into this
 * one. It also overrides the `__add__()` method to support concatenation
 * of `BaseMessageChunk` instances.
 */
class BaseMessageChunk extends BaseMessage {
    static _mergeAdditionalKwargs(left, right) {
        const merged = { ...left };
        for (const [key, value] of Object.entries(right)) {
            if (merged[key] === undefined) {
                merged[key] = value;
            }
            else if (typeof merged[key] !== typeof value) {
                throw new Error(`additional_kwargs[${key}] already exists in the message chunk, but with a different type.`);
            }
            else if (typeof merged[key] === "string") {
                merged[key] = merged[key] + value;
            }
            else if (!Array.isArray(merged[key]) &&
                typeof merged[key] === "object") {
                merged[key] = this._mergeAdditionalKwargs(merged[key], value);
            }
            else {
                throw new Error(`additional_kwargs[${key}] already exists in this message chunk.`);
            }
        }
        return merged;
    }
}
exports.BaseMessageChunk = BaseMessageChunk;
/**
 * Represents a human message in a conversation.
 */
class HumanMessage extends BaseMessage {
    static lc_name() {
        return "HumanMessage";
    }
    _getType() {
        return "human";
    }
}
exports.HumanMessage = HumanMessage;
/**
 * Represents a chunk of a human message, which can be concatenated with
 * other human message chunks.
 */
class HumanMessageChunk extends BaseMessageChunk {
    static lc_name() {
        return "HumanMessageChunk";
    }
    _getType() {
        return "human";
    }
    concat(chunk) {
        return new HumanMessageChunk({
            content: this.content + chunk.content,
            additional_kwargs: HumanMessageChunk._mergeAdditionalKwargs(this.additional_kwargs, chunk.additional_kwargs),
        });
    }
}
exports.HumanMessageChunk = HumanMessageChunk;
/**
 * Represents an AI message in a conversation.
 */
class AIMessage extends BaseMessage {
    static lc_name() {
        return "AIMessage";
    }
    _getType() {
        return "ai";
    }
}
exports.AIMessage = AIMessage;
/**
 * Represents a chunk of an AI message, which can be concatenated with
 * other AI message chunks.
 */
class AIMessageChunk extends BaseMessageChunk {
    static lc_name() {
        return "AIMessageChunk";
    }
    _getType() {
        return "ai";
    }
    concat(chunk) {
        return new AIMessageChunk({
            content: this.content + chunk.content,
            additional_kwargs: AIMessageChunk._mergeAdditionalKwargs(this.additional_kwargs, chunk.additional_kwargs),
        });
    }
}
exports.AIMessageChunk = AIMessageChunk;
/**
 * Represents a system message in a conversation.
 */
class SystemMessage extends BaseMessage {
    static lc_name() {
        return "SystemMessage";
    }
    _getType() {
        return "system";
    }
}
exports.SystemMessage = SystemMessage;
/**
 * Represents a chunk of a system message, which can be concatenated with
 * other system message chunks.
 */
class SystemMessageChunk extends BaseMessageChunk {
    static lc_name() {
        return "SystemMessageChunk";
    }
    _getType() {
        return "system";
    }
    concat(chunk) {
        return new SystemMessageChunk({
            content: this.content + chunk.content,
            additional_kwargs: SystemMessageChunk._mergeAdditionalKwargs(this.additional_kwargs, chunk.additional_kwargs),
        });
    }
}
exports.SystemMessageChunk = SystemMessageChunk;
/**
 * @deprecated
 * Use {@link BaseMessage} instead.
 */
exports.BaseChatMessage = BaseMessage;
/**
 * @deprecated
 * Use {@link HumanMessage} instead.
 */
exports.HumanChatMessage = HumanMessage;
/**
 * @deprecated
 * Use {@link AIMessage} instead.
 */
exports.AIChatMessage = AIMessage;
/**
 * @deprecated
 * Use {@link SystemMessage} instead.
 */
exports.SystemChatMessage = SystemMessage;
/**
 * Represents a function message in a conversation.
 */
class FunctionMessage extends BaseMessage {
    static lc_name() {
        return "FunctionMessage";
    }
    constructor(fields, 
    /** @deprecated */
    name) {
        if (typeof fields === "string") {
            // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
            fields = { content: fields, name: name };
        }
        super(fields);
    }
    _getType() {
        return "function";
    }
}
exports.FunctionMessage = FunctionMessage;
/**
 * Represents a chunk of a function message, which can be concatenated
 * with other function message chunks.
 */
class FunctionMessageChunk extends BaseMessageChunk {
    static lc_name() {
        return "FunctionMessageChunk";
    }
    _getType() {
        return "function";
    }
    concat(chunk) {
        return new FunctionMessageChunk({
            content: this.content + chunk.content,
            additional_kwargs: FunctionMessageChunk._mergeAdditionalKwargs(this.additional_kwargs, chunk.additional_kwargs),
            name: this.name ?? "",
        });
    }
}
exports.FunctionMessageChunk = FunctionMessageChunk;
/**
 * Represents a chat message in a conversation.
 */
class ChatMessage extends BaseMessage {
    static lc_name() {
        return "ChatMessage";
    }
    constructor(fields, role) {
        if (typeof fields === "string") {
            // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
            fields = { content: fields, role: role };
        }
        super(fields);
        Object.defineProperty(this, "role", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.role = fields.role;
    }
    _getType() {
        return "generic";
    }
    static isInstance(message) {
        return message._getType() === "generic";
    }
}
exports.ChatMessage = ChatMessage;
function isBaseMessage(messageLike) {
    return typeof messageLike._getType === "function";
}
exports.isBaseMessage = isBaseMessage;
function coerceMessageLikeToMessage(messageLike) {
    if (typeof messageLike === "string") {
        return new HumanMessage(messageLike);
    }
    else if (isBaseMessage(messageLike)) {
        return messageLike;
    }
    let role;
    let content;
    let name;
    if (Array.isArray(messageLike)) {
        [role, content] = messageLike;
        name = "";
    }
    else {
        role = messageLike.role;
        content = messageLike.content;
        name = messageLike.name;
    }
    if (role === "human" || role === "user") {
        return new HumanMessage({ content });
    }
    else if (role === "ai" || role === "assistant") {
        return new AIMessage({ content });
    }
    else if (role === "system") {
        return new SystemMessage({ content });
    }
    else if (role === "function") {
        if (!name) {
            throw new Error(`Unable to coerce function message from object: no "name" field provided.`);
        }
        return new FunctionMessage({ content, name });
    }
    else {
        return new ChatMessage({ content, role });
    }
}
exports.coerceMessageLikeToMessage = coerceMessageLikeToMessage;
/**
 * Represents a chunk of a chat message, which can be concatenated with
 * other chat message chunks.
 */
class ChatMessageChunk extends BaseMessageChunk {
    static lc_name() {
        return "ChatMessageChunk";
    }
    constructor(fields, role) {
        if (typeof fields === "string") {
            // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
            fields = { content: fields, role: role };
        }
        super(fields);
        Object.defineProperty(this, "role", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.role = fields.role;
    }
    _getType() {
        return "generic";
    }
    concat(chunk) {
        return new ChatMessageChunk({
            content: this.content + chunk.content,
            additional_kwargs: ChatMessageChunk._mergeAdditionalKwargs(this.additional_kwargs, chunk.additional_kwargs),
            role: this.role,
        });
    }
}
exports.ChatMessageChunk = ChatMessageChunk;
class ChatGenerationChunk extends GenerationChunk {
    constructor(fields) {
        super(fields);
        Object.defineProperty(this, "message", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.message = fields.message;
    }
    concat(chunk) {
        return new ChatGenerationChunk({
            text: this.text + chunk.text,
            generationInfo: {
                ...this.generationInfo,
                ...chunk.generationInfo,
            },
            message: this.message.concat(chunk.message),
        });
    }
}
exports.ChatGenerationChunk = ChatGenerationChunk;
/**
 * Base PromptValue class. All prompt values should extend this class.
 */
class BasePromptValue extends serializable_js_1.Serializable {
}
exports.BasePromptValue = BasePromptValue;
/**
 * Base class for all chat message histories. All chat message histories
 * should extend this class.
 */
class BaseChatMessageHistory extends serializable_js_1.Serializable {
}
exports.BaseChatMessageHistory = BaseChatMessageHistory;
/**
 * Base class for all list chat message histories. All list chat message
 * histories should extend this class.
 */
class BaseListChatMessageHistory extends serializable_js_1.Serializable {
    addUserMessage(message) {
        return this.addMessage(new HumanMessage(message));
    }
    addAIChatMessage(message) {
        return this.addMessage(new AIMessage(message));
    }
}
exports.BaseListChatMessageHistory = BaseListChatMessageHistory;
/**
 * Base class for all caches. All caches should extend this class.
 */
class BaseCache {
}
exports.BaseCache = BaseCache;
/**
 * Base class for all file stores. All file stores should extend this
 * class.
 */
class BaseFileStore extends serializable_js_1.Serializable {
}
exports.BaseFileStore = BaseFileStore;
/**
 * Base class for all entity stores. All entity stores should extend this
 * class.
 */
class BaseEntityStore extends serializable_js_1.Serializable {
}
exports.BaseEntityStore = BaseEntityStore;
/**
 * Abstract class for a document store. All document stores should extend
 * this class.
 */
class Docstore {
}
exports.Docstore = Docstore;
