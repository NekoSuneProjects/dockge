import crypto from "crypto";
import { Settings } from "./settings";
import { Request, Response } from "express";
import { DockgeServer } from "./dockge-server";
import { R } from "redbean-node";
import { generatePasswordHash } from "./password-hash";
import User from "./models/user";

interface OAuthStateEntry {
    verifier: string;
    providerID: string;
    expiresAt: number;
}

export interface OAuthProviderConfig {
    id: string;
    name: string;
    enabled: boolean;
    type: "oidc" | "oauth2";
    discoveryUrl: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    userInfoEndpoint: string;
    clientId: string;
    clientSecret: string;
    scopes: string;
    roleClaim: string;
    adminRoles: string[];
    autoCreateUsers: boolean;
    subjectClaim: string;
    usernameClaim: string;
    displayNameClaim: string;
    usePKCE: boolean;
}

const oauthStateMap = new Map<string, OAuthStateEntry>();
const FIVE_MINUTES = 5 * 60 * 1000;

export function getOAuthProviderPresets() {
    return [
        {
            id: "google",
            name: "Google",
            type: "oidc",
            discoveryUrl: "https://accounts.google.com/.well-known/openid-configuration",
            authorizationEndpoint: "",
            tokenEndpoint: "",
            userInfoEndpoint: "",
            scopes: "openid profile email",
            subjectClaim: "sub",
            usernameClaim: "email",
            displayNameClaim: "name",
            roleClaim: "roles",
            adminRoles: [],
            autoCreateUsers: true,
            usePKCE: true,
        },
        {
            id: "discord",
            name: "Discord",
            type: "oauth2",
            discoveryUrl: "",
            authorizationEndpoint: "https://discord.com/api/oauth2/authorize",
            tokenEndpoint: "https://discord.com/api/oauth2/token",
            userInfoEndpoint: "https://discord.com/api/users/@me",
            scopes: "identify email",
            subjectClaim: "id",
            usernameClaim: "email",
            displayNameClaim: "global_name",
            roleClaim: "roles",
            adminRoles: [],
            autoCreateUsers: true,
            usePKCE: true,
        }
    ];
}

async function getOAuthProviders(): Promise<OAuthProviderConfig[]> {
    const saved = await Settings.get("oauthProviders");
    if (Array.isArray(saved) && saved.length > 0) {
        return saved.map(normalizeProvider).filter((provider) => provider.id);
    }

    const legacyEnabled = await Settings.get("oauthEnabled");
    const legacyClientId = await Settings.get("oauthClientId");
    const legacyDiscoveryUrl = await Settings.get("oauthDiscoveryUrl");

    if (legacyEnabled && legacyClientId && legacyDiscoveryUrl) {
        return [ normalizeProvider({
            id: "oauth",
            name: await Settings.get("oauthName") || "OAuth 2",
            enabled: true,
            type: "oidc",
            discoveryUrl: legacyDiscoveryUrl,
            authorizationEndpoint: "",
            tokenEndpoint: "",
            userInfoEndpoint: "",
            clientId: legacyClientId,
            clientSecret: await Settings.get("oauthClientSecret") || "",
            scopes: await Settings.get("oauthScopes") || "openid profile email",
            roleClaim: await Settings.get("oauthRoleClaim") || "roles",
            adminRoles: await Settings.get("oauthAdminRoles") || [],
            autoCreateUsers: await Settings.get("oauthAutoCreateUsers") !== false,
            subjectClaim: "sub",
            usernameClaim: "preferred_username",
            displayNameClaim: "name",
            usePKCE: true,
        }) ];
    }

    return [];
}

function normalizeProvider(provider: Partial<OAuthProviderConfig>): OAuthProviderConfig {
    return {
        id: String(provider.id || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "-"),
        name: String(provider.name || "OAuth 2"),
        enabled: provider.enabled === true,
        type: provider.type === "oauth2" ? "oauth2" : "oidc",
        discoveryUrl: String(provider.discoveryUrl || ""),
        authorizationEndpoint: String(provider.authorizationEndpoint || ""),
        tokenEndpoint: String(provider.tokenEndpoint || ""),
        userInfoEndpoint: String(provider.userInfoEndpoint || ""),
        clientId: String(provider.clientId || ""),
        clientSecret: String(provider.clientSecret || ""),
        scopes: String(provider.scopes || "openid profile email"),
        roleClaim: String(provider.roleClaim || "roles"),
        adminRoles: Array.isArray(provider.adminRoles) ? provider.adminRoles.map(String) : [],
        autoCreateUsers: provider.autoCreateUsers !== false,
        subjectClaim: String(provider.subjectClaim || "sub"),
        usernameClaim: String(provider.usernameClaim || "preferred_username"),
        displayNameClaim: String(provider.displayNameClaim || "name"),
        usePKCE: provider.usePKCE !== false,
    };
}

export async function getOAuthProvidersForLogin() {
    return (await getOAuthProviders())
        .filter((provider) => provider.enabled && provider.clientId)
        .map((provider) => ({
            id: provider.id,
            name: provider.name,
        }));
}

async function getProvider(providerID: string) {
    const provider = (await getOAuthProviders()).find((item) => item.id === providerID && item.enabled);
    if (!provider) {
        throw new Error("OAuth provider not found.");
    }
    return provider;
}

async function getProviderEndpoints(provider: OAuthProviderConfig) {
    if (provider.type === "oidc") {
        if (!provider.discoveryUrl) {
            throw new Error("OIDC discovery URL is required.");
        }
        const response = await fetch(provider.discoveryUrl);
        if (!response.ok) {
            throw new Error("Failed to load OAuth discovery document.");
        }
        const discovery = await response.json() as Record<string, string>;
        return {
            authorizationEndpoint: discovery.authorization_endpoint,
            tokenEndpoint: discovery.token_endpoint,
            userInfoEndpoint: discovery.userinfo_endpoint || "",
        };
    }

    if (!provider.authorizationEndpoint || !provider.tokenEndpoint) {
        throw new Error("Authorization and token endpoints are required.");
    }

    return {
        authorizationEndpoint: provider.authorizationEndpoint,
        tokenEndpoint: provider.tokenEndpoint,
        userInfoEndpoint: provider.userInfoEndpoint,
    };
}

function base64URLEncode(buffer: Buffer) {
    return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function createCodeChallenge(verifier: string) {
    return base64URLEncode(crypto.createHash("sha256").update(verifier).digest());
}

function cleanupOAuthState() {
    const now = Date.now();
    for (const [ state, entry ] of oauthStateMap.entries()) {
        if (entry.expiresAt <= now) {
            oauthStateMap.delete(state);
        }
    }
}

export async function startOAuth(response: Response, request: Request) {
    cleanupOAuthState();
    const providerID = String(request.params.providerID || request.query.provider || "");
    const provider = await getProvider(providerID);
    const endpoints = await getProviderEndpoints(provider);

    const state = base64URLEncode(crypto.randomBytes(24));
    const verifier = base64URLEncode(crypto.randomBytes(32));
    oauthStateMap.set(state, {
        verifier,
        providerID,
        expiresAt: Date.now() + FIVE_MINUTES,
    });

    const redirectURL = new URL(endpoints.authorizationEndpoint);
    const callbackURL = `${request.protocol}://${request.get("host")}/auth/oauth/callback/${providerID}`;
    redirectURL.searchParams.set("response_type", "code");
    redirectURL.searchParams.set("client_id", provider.clientId);
    redirectURL.searchParams.set("redirect_uri", callbackURL);
    redirectURL.searchParams.set("scope", provider.scopes);
    redirectURL.searchParams.set("state", state);

    if (provider.usePKCE) {
        redirectURL.searchParams.set("code_challenge", createCodeChallenge(verifier));
        redirectURL.searchParams.set("code_challenge_method", "S256");
    }

    response.redirect(redirectURL.toString());
}

function getRoleFromClaims(claims: Record<string, unknown>, provider: OAuthProviderConfig): "admin" | "user" {
    const rawValue = claims[provider.roleClaim];
    const values = Array.isArray(rawValue) ? rawValue.map(String) : rawValue ? [ String(rawValue) ] : [];
    return values.some((value) => provider.adminRoles.includes(value)) ? "admin" : "user";
}

async function getUserInfo(provider: OAuthProviderConfig, accessToken: string, fallbackClaims: Record<string, unknown>, endpoints: { userInfoEndpoint?: string }) {
    if (!endpoints.userInfoEndpoint) {
        return fallbackClaims;
    }

    const response = await fetch(endpoints.userInfoEndpoint, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        }
    });

    if (!response.ok) {
        throw new Error("Failed to load OAuth user information.");
    }

    return await response.json() as Record<string, unknown>;
}

export async function completeOAuth(server: DockgeServer, response: Response, request: Request) {
    cleanupOAuthState();
    const providerID = String(request.params.providerID || "");
    const state = typeof request.query.state === "string" ? request.query.state : "";
    const code = typeof request.query.code === "string" ? request.query.code : "";
    const stateEntry = oauthStateMap.get(state);

    if (!stateEntry || !code || stateEntry.providerID !== providerID) {
        response.status(400).send("OAuth state is invalid or expired.");
        return;
    }

    oauthStateMap.delete(state);
    const provider = await getProvider(providerID);
    const endpoints = await getProviderEndpoints(provider);
    const callbackURL = `${request.protocol}://${request.get("host")}/auth/oauth/callback/${providerID}`;

    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: callbackURL,
        client_id: provider.clientId,
        client_secret: provider.clientSecret,
    });

    if (provider.usePKCE) {
        body.set("code_verifier", stateEntry.verifier);
    }

    const tokenResponse = await fetch(endpoints.tokenEndpoint, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
    });

    if (!tokenResponse.ok) {
        response.status(400).send("OAuth token exchange failed.");
        return;
    }

    const tokenData = await tokenResponse.json() as Record<string, string>;
    const idTokenClaims = tokenData.id_token ? parseJWTClaims(tokenData.id_token) : {};
    const claims = await getUserInfo(provider, tokenData.access_token, idTokenClaims, endpoints);
    const subject = String(claims[provider.subjectClaim] || idTokenClaims[provider.subjectClaim] || "");

    if (!subject) {
        response.status(400).send("OAuth subject is missing.");
        return;
    }

    let user = await R.findOne("user", " auth_provider = ? AND provider_subject = ? AND active = 1 ", [
        `oauth:${providerID}`,
        subject,
    ]) as User | null;

    if (!user && !provider.autoCreateUsers) {
        response.status(403).send("OAuth user provisioning is disabled.");
        return;
    }

    const username = String(
        claims[provider.usernameClaim]
        || idTokenClaims[provider.usernameClaim]
        || claims.email
        || `${providerID}_${subject}`
    );
    const displayName = String(
        claims[provider.displayNameClaim]
        || idTokenClaims[provider.displayNameClaim]
        || claims.name
        || username
    );
    const role = getRoleFromClaims(claims, provider);

    if (!user) {
        user = R.dispense("user") as User;
        user.username = username;
        user.password = generatePasswordHash(crypto.randomUUID());
        user.auth_provider = `oauth:${providerID}`;
        user.provider_subject = subject;
    }

    user.display_name = displayName;
    user.role = user.role || role;
    user.active = true;
    await R.store(user);

    const token = User.createJWT(user, server.jwtSecret);
    response.setHeader("Content-Type", "text/html; charset=utf-8");
    response.send(`<!doctype html><html><body><script>
const payload = { type: "dockge-oauth", token: ${JSON.stringify(token)} };
if (window.opener && window.opener !== window) {
  window.opener.postMessage(payload, window.location.origin);
  window.close();
} else {
  localStorage.setItem("dockge-oauth-token", payload.token);
  window.location.href = "/";
}
</script></body></html>`);
}

function parseJWTClaims(token: string): Record<string, unknown> {
    const parts = token.split(".");
    if (parts.length < 2) {
        return {};
    }
    return JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8")) as Record<string, unknown>;
}
