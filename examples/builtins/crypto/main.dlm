import { Crypto } from "mint:crypto";
import { println } from "mint:io";

export function main(): void {
  let secret: string = "doublemint";
  let token: int = Crypto.hashFnv1a(secret);
  let cipher: string = Crypto.xorCipher(secret, "k");
  let restored: string = Crypto.xorCipher(cipher, "k");

  println("hash=", token);
  println("hash_hex=", Crypto.toHex(token));
  println("cipher_len=", cipher);
  println("restored=", restored);
}
