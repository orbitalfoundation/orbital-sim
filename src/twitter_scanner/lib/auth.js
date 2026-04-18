import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { TwitterApi } from "twitter-api-v2";

function getAppCredentials() {
  return {
    appKey: process.env.TWITTER_CONSUMER_KEY || process.env.TWITTER_API_KEY || null,
    appSecret: process.env.TWITTER_SECRET_KEY || process.env.TWITTER_API_SECRET || null,
    clientId: process.env.TWITTER_CLIENT_ID || null,
    clientSecret: process.env.TWITTER_CLIENT_SECRET || null
  };
}

function printEnvBlock(lines) {
  console.log("\nAdd these to your .env:\n");
  for (const line of lines) {
    console.log(line);
  }
  console.log();
}

export async function runAuthFlow() {
  const rl = readline.createInterface({ input, output });

  try {
    const callbackUrl = "http://127.0.0.1:3000/twitter/callback";
    const creds = getAppCredentials();

    if (creds.clientId) {
      const client = new TwitterApi({ clientId: creds.clientId, clientSecret: creds.clientSecret || undefined });
      const { url, codeVerifier, state } = client.generateOAuth2AuthLink(callbackUrl, {
        scope: ["tweet.read", "users.read", "like.read", "bookmark.read", "offline.access"]
      });

      console.log("Open this URL in your browser and authorize the app:\n");
      console.log(url);
      console.log();

      const redirectedUrl = await rl.question("Paste the full redirect URL here: ");
      const parsed = new URL(redirectedUrl.trim());
      const code = parsed.searchParams.get("code");
      const returnedState = parsed.searchParams.get("state");

      if (!code) {
        throw new Error("Missing code in redirect URL.");
      }
      if (returnedState !== state) {
        throw new Error("State mismatch in OAuth2 callback.");
      }

      const login = await client.loginWithOAuth2({
        code,
        codeVerifier,
        redirectUri: callbackUrl
      });

      printEnvBlock([
        `TWITTER_OAUTH2_ACCESS_TOKEN=${login.accessToken}`,
        `TWITTER_OAUTH2_REFRESH_TOKEN=${login.refreshToken || ""}`
      ]);

      console.log("OAuth2 user token acquired.");
      return;
    }

    if (!creds.appKey || !creds.appSecret) {
      throw new Error("Missing TWITTER_CONSUMER_KEY/TWITTER_SECRET_KEY or TWITTER_CLIENT_ID.");
    }

    const requestClient = new TwitterApi({
      appKey: creds.appKey,
      appSecret: creds.appSecret
    });

    const link = await requestClient.generateAuthLink(callbackUrl, { linkMode: "authorize" });

    console.log("Open this URL in your browser and authorize the app:\n");
    console.log(link.url);
    console.log();

    const redirectedUrl = await rl.question("Paste the full redirect URL here: ");
    const parsed = new URL(redirectedUrl.trim());
    const oauthVerifier = parsed.searchParams.get("oauth_verifier");
    const oauthToken = parsed.searchParams.get("oauth_token");

    if (!oauthVerifier || !oauthToken) {
      throw new Error("Missing oauth_verifier or oauth_token in redirect URL.");
    }

    const login = await requestClient.login(oauthVerifier, oauthToken, link.oauth_token_secret);

    printEnvBlock([
      `TWITTER_ACCESS_TOKEN=${login.accessToken}`,
      `TWITTER_ACCESS_TOKEN_SECRET=${login.accessSecret}`,
      `TWITTER_USERNAME=${login.screenName || ""}`,
      `TWITTER_USER_ID=${login.userId || ""}`
    ]);

    console.log("OAuth1 user token acquired.");
  } finally {
    rl.close();
  }
}
