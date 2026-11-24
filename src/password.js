import { pbkdf2, randomBytes, randomInt } from "node:crypto";
import { promisify } from "node:util";

const pbkdf2Async = promisify(pbkdf2);
const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ITERATIONS = 600_000;

export async function preparePassword(
  value,
  {
    randomBytesFn = randomBytes,
    randomIntFn = randomInt,
    derive = pbkdf2Async,
  } = {},
) {
  const password = value === undefined
    ? Array.from(
        { length: 6 },
        () => PASSWORD_ALPHABET[randomIntFn(PASSWORD_ALPHABET.length)],
      ).join("")
    : value;

  if (typeof password !== "string")
    throw Object.assign(new Error("Password must be text."), {
      code: "password_invalid",
    });
  const length = [...password].length;
  if (length < 6 || length > 128)
    throw Object.assign(new Error("Password must contain 6 to 128 characters."), {
      code: "password_invalid",
    });

  const saltBytes = randomBytesFn(16);
  const verifierBytes = await derive(
    password,
    saltBytes,
    ITERATIONS,
    32,
    "sha256",
  );
  return {
    password,
    salt: Buffer.from(saltBytes).toString("base64url"),
    verifier: Buffer.from(verifierBytes).toString("base64url"),
    iterations: ITERATIONS,
  };
}
