const { get_encoding } = require("tiktoken");

const enc = get_encoding("cl100k_base");
const text = "Hello World! 这里的每一个色块代表一个独立的 Token。";
const tokens = enc.encode(text);

console.log("Tokens:", tokens);

// Check if we can decode single token to bytes
try {
    // In python it is decode_single_token_bytes
    // In node tiktoken, let's check
    const token = tokens[0];
    // Try to find a method that returns bytes
    console.log("Methods:", Object.keys(enc));
    console.log("Prototype:", Object.getPrototypeOf(enc));
    
    // Try decode_single_token_bytes
    if (enc.decode_single_token_bytes) {
        console.log("decode_single_token_bytes exists");
        const bytes = enc.decode_single_token_bytes(token);
        console.log("Bytes for token 0:", bytes);
    }
} catch (e) {
    console.log("Error:", e.message);
}
