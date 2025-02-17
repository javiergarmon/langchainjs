"use strict";
// Default generic "any" values are for backwards compatibility.
// Replace with "string" when we are comfortable with a breaking change.
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatPromptTemplate = exports.SystemMessagePromptTemplate = exports.AIMessagePromptTemplate = exports.HumanMessagePromptTemplate = exports.ChatMessagePromptTemplate = exports.BaseChatPromptTemplate = exports.BaseMessageStringPromptTemplate = exports.MessagesPlaceholder = exports.ChatPromptValue = exports.BaseMessagePromptTemplate = void 0;
const index_js_1 = require("../schema/index.cjs");
const runnable_js_1 = require("../schema/runnable.cjs");
const base_js_1 = require("./base.cjs");
const prompt_js_1 = require("./prompt.cjs");
/**
 * Abstract class that serves as a base for creating message prompt
 * templates. It defines how to format messages for different roles in a
 * conversation.
 */
class BaseMessagePromptTemplate extends runnable_js_1.Runnable {
    constructor() {
        super(...arguments);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "prompts", "chat"]
        });
        Object.defineProperty(this, "lc_serializable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
    }
    /**
     * Calls the formatMessages method with the provided input and options.
     * @param input Input for the formatMessages method
     * @param options Optional BaseCallbackConfig
     * @returns Formatted output messages
     */
    async invoke(input, options) {
        return this._callWithConfig((input) => this.formatMessages(input), input, { ...options, runType: "prompt" });
    }
}
exports.BaseMessagePromptTemplate = BaseMessagePromptTemplate;
/**
 * Class that represents a chat prompt value. It extends the
 * BasePromptValue and includes an array of BaseMessage instances.
 */
class ChatPromptValue extends index_js_1.BasePromptValue {
    static lc_name() {
        return "ChatPromptValue";
    }
    constructor(fields) {
        if (Array.isArray(fields)) {
            // eslint-disable-next-line no-param-reassign
            fields = { messages: fields };
        }
        super(...arguments);
        Object.defineProperty(this, "lc_namespace", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: ["langchain", "prompts", "chat"]
        });
        Object.defineProperty(this, "lc_serializable", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.defineProperty(this, "messages", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.messages = fields.messages;
    }
    toString() {
        return JSON.stringify(this.messages);
    }
    toChatMessages() {
        return this.messages;
    }
}
exports.ChatPromptValue = ChatPromptValue;
/**
 * Class that represents a placeholder for messages in a chat prompt. It
 * extends the BaseMessagePromptTemplate.
 */
class MessagesPlaceholder extends BaseMessagePromptTemplate {
    static lc_name() {
        return "MessagesPlaceholder";
    }
    constructor(fields) {
        if (typeof fields === "string") {
            // eslint-disable-next-line no-param-reassign
            fields = { variableName: fields };
        }
        super(fields);
        Object.defineProperty(this, "variableName", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.variableName = fields.variableName;
    }
    get inputVariables() {
        return [this.variableName];
    }
    formatMessages(values) {
        return Promise.resolve(values[this.variableName]);
    }
}
exports.MessagesPlaceholder = MessagesPlaceholder;
/**
 * Abstract class that serves as a base for creating message string prompt
 * templates. It extends the BaseMessagePromptTemplate.
 */
class BaseMessageStringPromptTemplate extends BaseMessagePromptTemplate {
    constructor(fields) {
        if (!("prompt" in fields)) {
            // eslint-disable-next-line no-param-reassign
            fields = { prompt: fields };
        }
        super(fields);
        Object.defineProperty(this, "prompt", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        this.prompt = fields.prompt;
    }
    get inputVariables() {
        return this.prompt.inputVariables;
    }
    async formatMessages(values) {
        return [await this.format(values)];
    }
}
exports.BaseMessageStringPromptTemplate = BaseMessageStringPromptTemplate;
/**
 * Abstract class that serves as a base for creating chat prompt
 * templates. It extends the BasePromptTemplate.
 */
class BaseChatPromptTemplate extends base_js_1.BasePromptTemplate {
    constructor(input) {
        super(input);
    }
    async format(values) {
        return (await this.formatPromptValue(values)).toString();
    }
    async formatPromptValue(values) {
        const resultMessages = await this.formatMessages(values);
        return new ChatPromptValue(resultMessages);
    }
}
exports.BaseChatPromptTemplate = BaseChatPromptTemplate;
/**
 * Class that represents a chat message prompt template. It extends the
 * BaseMessageStringPromptTemplate.
 */
class ChatMessagePromptTemplate extends BaseMessageStringPromptTemplate {
    static lc_name() {
        return "ChatMessagePromptTemplate";
    }
    constructor(fields, role) {
        if (!("prompt" in fields)) {
            // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-non-null-assertion
            fields = { prompt: fields, role: role };
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
    async format(values) {
        return new index_js_1.ChatMessage(await this.prompt.format(values), this.role);
    }
    static fromTemplate(template, role) {
        return new this(prompt_js_1.PromptTemplate.fromTemplate(template), role);
    }
}
exports.ChatMessagePromptTemplate = ChatMessagePromptTemplate;
/**
 * Class that represents a human message prompt template. It extends the
 * BaseMessageStringPromptTemplate.
 */
class HumanMessagePromptTemplate extends BaseMessageStringPromptTemplate {
    static lc_name() {
        return "HumanMessagePromptTemplate";
    }
    async format(values) {
        return new index_js_1.HumanMessage(await this.prompt.format(values));
    }
    static fromTemplate(template) {
        return new this(prompt_js_1.PromptTemplate.fromTemplate(template));
    }
}
exports.HumanMessagePromptTemplate = HumanMessagePromptTemplate;
/**
 * Class that represents an AI message prompt template. It extends the
 * BaseMessageStringPromptTemplate.
 */
class AIMessagePromptTemplate extends BaseMessageStringPromptTemplate {
    static lc_name() {
        return "AIMessagePromptTemplate";
    }
    async format(values) {
        return new index_js_1.AIMessage(await this.prompt.format(values));
    }
    static fromTemplate(template) {
        return new this(prompt_js_1.PromptTemplate.fromTemplate(template));
    }
}
exports.AIMessagePromptTemplate = AIMessagePromptTemplate;
/**
 * Class that represents a system message prompt template. It extends the
 * BaseMessageStringPromptTemplate.
 */
class SystemMessagePromptTemplate extends BaseMessageStringPromptTemplate {
    static lc_name() {
        return "SystemMessagePromptTemplate";
    }
    async format(values) {
        return new index_js_1.SystemMessage(await this.prompt.format(values));
    }
    static fromTemplate(template) {
        return new this(prompt_js_1.PromptTemplate.fromTemplate(template));
    }
}
exports.SystemMessagePromptTemplate = SystemMessagePromptTemplate;
function _isBaseMessagePromptTemplate(baseMessagePromptTemplateLike) {
    return (typeof baseMessagePromptTemplateLike
        .formatMessages === "function");
}
function _coerceMessagePromptTemplateLike(messagePromptTemplateLike) {
    if (_isBaseMessagePromptTemplate(messagePromptTemplateLike) ||
        (0, index_js_1.isBaseMessage)(messagePromptTemplateLike)) {
        return messagePromptTemplateLike;
    }
    const message = (0, index_js_1.coerceMessageLikeToMessage)(messagePromptTemplateLike);
    if (message._getType() === "human") {
        return HumanMessagePromptTemplate.fromTemplate(message.content);
    }
    else if (message._getType() === "ai") {
        return AIMessagePromptTemplate.fromTemplate(message.content);
    }
    else if (message._getType() === "system") {
        return SystemMessagePromptTemplate.fromTemplate(message.content);
    }
    else if (index_js_1.ChatMessage.isInstance(message)) {
        return ChatMessagePromptTemplate.fromTemplate(message.content, message.role);
    }
    else {
        throw new Error(`Could not coerce message prompt template from input. Received message type: "${message._getType()}".`);
    }
}
/**
 * Class that represents a chat prompt. It extends the
 * BaseChatPromptTemplate and uses an array of BaseMessagePromptTemplate
 * instances to format a series of messages for a conversation.
 */
class ChatPromptTemplate extends BaseChatPromptTemplate {
    static lc_name() {
        return "ChatPromptTemplate";
    }
    get lc_aliases() {
        return {
            promptMessages: "messages",
        };
    }
    constructor(input) {
        super(input);
        Object.defineProperty(this, "promptMessages", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: void 0
        });
        Object.defineProperty(this, "validateTemplate", {
            enumerable: true,
            configurable: true,
            writable: true,
            value: true
        });
        Object.assign(this, input);
        if (this.validateTemplate) {
            const inputVariablesMessages = new Set();
            for (const promptMessage of this.promptMessages) {
                // eslint-disable-next-line no-instanceof/no-instanceof
                if (promptMessage instanceof index_js_1.BaseMessage)
                    continue;
                for (const inputVariable of promptMessage.inputVariables) {
                    inputVariablesMessages.add(inputVariable);
                }
            }
            const totalInputVariables = this.inputVariables;
            const inputVariablesInstance = new Set(this.partialVariables
                ? totalInputVariables.concat(Object.keys(this.partialVariables))
                : totalInputVariables);
            const difference = new Set([...inputVariablesInstance].filter((x) => !inputVariablesMessages.has(x)));
            if (difference.size > 0) {
                throw new Error(`Input variables \`${[
                    ...difference,
                ]}\` are not used in any of the prompt messages.`);
            }
            const otherDifference = new Set([...inputVariablesMessages].filter((x) => !inputVariablesInstance.has(x)));
            if (otherDifference.size > 0) {
                throw new Error(`Input variables \`${[
                    ...otherDifference,
                ]}\` are used in prompt messages but not in the prompt template.`);
            }
        }
    }
    _getPromptType() {
        return "chat";
    }
    async formatMessages(values) {
        const allValues = await this.mergePartialAndUserVariables(values);
        let resultMessages = [];
        for (const promptMessage of this.promptMessages) {
            // eslint-disable-next-line no-instanceof/no-instanceof
            if (promptMessage instanceof index_js_1.BaseMessage) {
                resultMessages.push(promptMessage);
            }
            else {
                const inputValues = promptMessage.inputVariables.reduce((acc, inputVariable) => {
                    if (!(inputVariable in allValues)) {
                        throw new Error(`Missing value for input variable \`${inputVariable.toString()}\``);
                    }
                    acc[inputVariable] = allValues[inputVariable];
                    return acc;
                }, {});
                const message = await promptMessage.formatMessages(inputValues);
                resultMessages = resultMessages.concat(message);
            }
        }
        return resultMessages;
    }
    async partial(values) {
        // This is implemented in a way it doesn't require making
        // BaseMessagePromptTemplate aware of .partial()
        const newInputVariables = this.inputVariables.filter((iv) => !(iv in values));
        const newPartialVariables = {
            ...(this.partialVariables ?? {}),
            ...values,
        };
        const promptDict = {
            ...this,
            inputVariables: newInputVariables,
            partialVariables: newPartialVariables,
        };
        return new ChatPromptTemplate(promptDict);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static fromPromptMessages(promptMessages) {
        const flattenedMessages = promptMessages.reduce((acc, promptMessage) => acc.concat(
        // eslint-disable-next-line no-instanceof/no-instanceof
        promptMessage instanceof ChatPromptTemplate
            ? promptMessage.promptMessages
            : [_coerceMessagePromptTemplateLike(promptMessage)]), []);
        const flattenedPartialVariables = promptMessages.reduce((acc, promptMessage) => 
        // eslint-disable-next-line no-instanceof/no-instanceof
        promptMessage instanceof ChatPromptTemplate
            ? Object.assign(acc, promptMessage.partialVariables)
            : acc, Object.create(null));
        const inputVariables = new Set();
        for (const promptMessage of flattenedMessages) {
            // eslint-disable-next-line no-instanceof/no-instanceof
            if (promptMessage instanceof index_js_1.BaseMessage)
                continue;
            for (const inputVariable of promptMessage.inputVariables) {
                if (inputVariable in flattenedPartialVariables) {
                    continue;
                }
                inputVariables.add(inputVariable);
            }
        }
        return new ChatPromptTemplate({
            inputVariables: [...inputVariables],
            promptMessages: flattenedMessages,
            partialVariables: flattenedPartialVariables,
        });
    }
}
exports.ChatPromptTemplate = ChatPromptTemplate;
