const { Client, Intents } = require("discord.js-selfbot-v13");
const axios = require("axios"); // For REST API requests
const fs = require("fs");
const colors = require("colors");

const validTokens = [];
const invalidTokens = [];

let totalScanned = 0;
let emailConnected = 0;
let phoneConnected = 0;
let bothConnected = 0;
let twoFAEnabled = 0;
let nitroCount = 0;
let boostAvailableCount = 0; // Tokens with available boosts
let canBoostCount = 0; // Tokens that can boost a server

async function checkToken(token) {
    const client = new Client({
        intents: [Intents.FLAGS.GUILDS],
        checkUpdate: false,
    });

    try {
        await client.login(token);
    } catch (error) {
        console.log(`Token: ${token.slice(0, 20)}... is invalid!`.red);
        invalidTokens.push(token);
        totalScanned++;
        return;
    }

    const user = client.user;
    if (user) {
        console.log(`\nToken: ${token.slice(0, 20)}... is valid!`.green);
        console.log(`Username: ${user.tag}`.cyan);
        console.log(`User ID: ${user.id}`.cyan);
        console.log(`Email Verified: ${user.verified ? "Yes" : "No"}`.cyan);
        console.log(`2FA Enabled: ${user.mfaEnabled ? "Yes" : "No"}`.cyan);
        console.log(`Phone Verified: ${user.phone ? "Yes" : "No"}`.cyan);
        console.log(`Join Date: ${user.createdAt.toISOString()}`.cyan);

        if (user.verified) emailConnected++;
        if (user.phone) phoneConnected++;
        if (user.verified && user.phone) bothConnected++;
        if (user.mfaEnabled) twoFAEnabled++;

        // Check Nitro Status
        const nitroTypes = {
            1: "Nitro Classic",
            2: "Nitro",
            3: "Nitro Basic"
        };
        const nitroStatus = nitroTypes[user.premiumType] || "Inactive";
        if (nitroStatus !== "Inactive") {
            nitroCount++;
            console.log(`Nitro Status: ${nitroStatus}`.magenta);
        } else {
            console.log("Nitro Status: Inactive".magenta);
        }

        // Fetch Boost Information via REST API
        let boostsAvailable = 0;
        try {
            const response = await axios.get("https://discord.com/api/v9/users/@me/guilds/premium/subscription-slots", {
                headers: {
                    Authorization: token,
                },
            });

            // Count available boosts (slots not on cooldown)
            boostsAvailable = response.data.filter(slot => slot.cooldown_ends_at === null).length;
            console.log(`Boosts Available (API): ${boostsAvailable}`.magenta);
        } catch (error) {
            console.log("Failed to fetch boost information from API.".red);
        }

        // Check if the token can boost a server
        const canBoost = nitroStatus !== "Inactive" && boostsAvailable > 0;
        if (canBoost) {
            console.log("This token CAN boost a server.".green);
            canBoostCount++; // Increment can boost count
        } else {
            console.log("This token CANNOT boost a server.".red);
        }

        // Save valid token details
        validTokens.push({
            token: token,
            username: user.tag,
            userId: user.id,
            emailVerified: user.verified,
            twoFAEnabled: user.mfaEnabled,
            phoneVerified: user.phone,
            joinDate: user.createdAt.toISOString(),
            nitroStatus: nitroStatus,
            boostsAvailable: boostsAvailable,
            canBoost: canBoost, // Add whether the token can boost
        });
    } else {
        console.log("Failed to fetch user information.".red);
    }

    totalScanned++;

    client.destroy();
}

function writeTokensToFiles() {
    // Save valid tokens to a file
    fs.writeFileSync("valid_tokens.txt", validTokens.map(t => t.token).join("\n"), "utf-8");

    // Save detailed valid tokens to a file
    const detailedTokens = validTokens.map(t => {
        const details = [
            `Token: ${t.token}`,
            `Username: ${t.username}`,
            `User ID: ${t.userId}`,
            `Email Verified: ${t.emailVerified ? "Yes" : "No"}`,
            `2FA Enabled: ${t.twoFAEnabled ? "Yes" : "No"}`,
            `Phone Verified: ${t.phoneVerified ? "Yes" : "No"}`,
            `Join Date: ${t.joinDate}`,
            `Nitro Status: ${t.nitroStatus}`,
            `Boosts Available: ${t.boostsAvailable}`,
            `Can Boost: ${t.canBoost ? "Yes" : "No"}`,
        ];

        return details.join(" | ");
    });

    fs.writeFileSync("detailed_valid_tokens.txt", detailedTokens.join("\n\n"), "utf-8");

    console.log("\nValid tokens have been saved to valid_tokens.txt".green);
    console.log("Detailed valid tokens have been saved to detailed_valid_tokens.txt".green);
    console.log("Invalid tokens have been saved to invalid_tokens.txt".red);
}

function printMetrics() {
    console.log("\n=== Metrics ===".bold);
    console.log(`Total Tokens Scanned: ${totalScanned}`.cyan);
    console.log(`Tokens with Email Connected: ${emailConnected}`.cyan);
    console.log(`Tokens with Phone Connected: ${phoneConnected}`.cyan);
    console.log(`Tokens with Both Email and Phone Connected: ${bothConnected}`.cyan);
    console.log(`Tokens with 2FA Enabled: ${twoFAEnabled}`.cyan);
    console.log(`Tokens with Nitro: ${nitroCount}`.magenta);
    console.log(`Tokens with Boosts Available: ${boostAvailableCount}`.magenta);
    console.log(`Tokens that CAN Boost: ${canBoostCount}`.magenta); // New metric
}

async function main() {
    try {
        const tokens = fs.readFileSync("tokens.txt", "utf-8").split("\n").filter((token) => token.trim());
        if (tokens.length === 0) {
            console.log("No tokens found in tokens.txt".red);
            return;
        }

        for (const token of tokens) {
            await checkToken(token.trim());
            await new Promise(resolve => setTimeout(resolve, 1));
        }

        writeTokensToFiles();

        printMetrics();
    } catch (error) {
        console.log("Error: tokens.txt file not found".red);
    }
}

main();
