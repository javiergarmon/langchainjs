"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateMaxTokens = exports.BaseLanguageModel = exports.BaseLangChain = void 0;
const index_js_1 = require("../schema/index.cjs");
const async_caller_js_1 = require("../util/async_caller.cjs");
const count_tokens_js_1 = require("./count_tokens.cjs");
const tiktoken_js_1 = require("../util/tiktoken.cjs");
const runnable_js_1 = require("../schema/runnable.cjs");
const base_js_1 = require("../prompts/base.cjs");
const chat_js_1 = require("../prompts/chat.cjs");
const getVerbosity = () => false;
/**
 * Base class for language models, chains, tools.
 */
class BaseLangChain extends runnable_js_1.Runnable {
    get lc_attributes() {
        return {
            callbacks: undefined,
            verbose: undefined,
        };
    }
    constructor(params) {
        super(params);
        /**
         * Whether to print out response text.
         */
        Object.defineProperty(this, "verbose", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "callbacks", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "tags", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "metadata", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.verbose = params.verbose ?? getVerbosity();
        this.callbacks = params.callbacks;
        this.tags = params.tags ?? [];
        this.metadata = params.metadata ?? {};
    }
}
exports.BaseLangChain = BaseLangChain;
/**
 * Base class for language models.
 */
class BaseLanguageModel extends BaseLangChain {
    /**
     * Keys that the language model accepts as call options.
     */
    get callKeys() {
        return ["stop", "timeout", "signal", "tags", "metadata", "callbacks"];
    }
    constructor({ callbacks, callbackManager, ...params }) {
        super({
            callbacks: callbacks ?? callbackManager,
            ...params,
        });
        /**
         * The async caller should be used by subclasses to make any async calls,
         * which will thus benefit from the concurrency and retry logic.
         */
        Object.defineProperty(this, "caller", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "_encoding", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.caller = new async_caller_js_1.AsyncCaller(params ?? {});
    }
    async getNumTokens(text) {
        // fallback to approximate calculation if tiktoken is not available
        let numTokens = Math.ceil(text.length / 4);
        if (!this._encoding) {
            try {
                this._encoding = await (0, tiktoken_js_1.encodingForModel)("modelName" in this
                    ? (0, count_tokens_js_1.getModelNameForTiktoken)(this.modelName)
                    : "gpt2");
            }
            catch (error) {
                console.warn("Failed to calculate number of tokens, falling back to approximate count", error);
            }
        }
        if (this._encoding) {
            numTokens = this._encoding.encode(text).length;
        }
        return numTokens;
    }
    static _convertInputToPromptValue(input) {
        if (typeof input === "string") {
            return new base_js_1.StringPromptValue(input);
        }
        else if (Array.isArray(input)) {
            return new chat_js_1.ChatPromptValue(input.map(index_js_1.coerceMessageLikeToMessage));
        }
        else {
            return input;
        }
    }
    /**
     * Get the identifying parameters of the LLM.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _identifyingParams() {
        return {};
    }
    /**
     * @deprecated
     * Return a json-like object representing this LLM.
     */
    serialize() {
        return {
            ...this._identifyingParams(),
            _type: this._llmType(),
            _model: this._modelType(),
        };
    }
    /**
     * @deprecated
     * Load an LLM from a json-like object describing it.
     */
    static async deserialize(data) {
        const { _type, _model, ...rest } = data;
        if (_model && _model !== "base_chat_model") {
            throw new Error(`Cannot load LLM with model ${_model}`);
        }
        const Cls = {
            openai: (await import("../chat_models/openai.js")).ChatOpenAI,
        }[_type];
        if (Cls === undefined) {
            throw new Error(`Cannot load LLM with type ${_type}`);
        }
        return new Cls(rest);
    }
}
exports.BaseLanguageModel = BaseLanguageModel;
/*
 * Calculate max tokens for given model and prompt.
 * That is the model size - number of tokens in prompt.
 */
var count_tokens_js_2 = require("./count_tokens.cjs");
Object.defineProperty(exports, "calculateMaxTokens", { enumerable: true, get: function () { return count_tokens_js_2.calculateMaxTokens; } });
