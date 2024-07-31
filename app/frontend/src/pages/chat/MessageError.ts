export class MessageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = this.constructor.name;
        Object.setPrototypeOf(this, MessageError.prototype);
    }

    toString(): string {
        return `${this.message}`;
    }
}
