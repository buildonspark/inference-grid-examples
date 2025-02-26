import * as ed25519 from '@noble/ed25519';
import { sha512 } from "@noble/hashes/sha512";
import {Network, Role, InferenceGridClient} from "spark-ig-sdk"

ed25519.etc.sha512Sync = (...m) => sha512(ed25519.etc.concatBytes(...m));

let client = new InferenceGridClient({
    "network": Network.REGTEST,
    "publicKey": "385bebd967fb73dacc872f9279dd69d8bed9e9cbadca15a20a70196f5a45fbee",
    "privateKey": "cfb02b6bdc0a7af386bb8f3a9d90b5b2fa720a23ebc4e452b5339561f1f98da3",
})

InferenceGridClient.generateConfig(Network.REGTEST).then((config: any) => {
    client = new InferenceGridClient(config)
})

export { client, Role, Network };
