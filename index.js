require('dotenv').config();
const axios = require('axios');
const fs = require('fs');

const EMAIL = process.env.SOLIX_EMAIL;
const PASSWORD = process.env.SOLIX_PASSWORD;

const BASE_URL = 'https://api.solixdepin.net/api';
const LOGIN_URL = `${BASE_URL}/auth/login-password`;
const TASKS_URL = `${BASE_URL}/task/get-user-task`;
const CLAIM_TASK_URL = `${BASE_URL}/task/claim-task`;
const TOTAL_POINT_URL = `${BASE_URL}/point/get-total-point`;
const CONNECTION_QUALITY_URL = `${BASE_URL}/point/get-connection-quality`;

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const WHITE = "\x1b[37m";
const CYAN = "\x1b[36m";

let token = null;
let userInfo = null;
let connectionQualityInterval = null;
let taskCheckInterval = null;

function printBanner() {
    console.log(`${CYAN}----------------------------------------${RESET}`);
    console.log(`${CYAN}     Solix Depin Auto Bot - Airdrop Insiders     ${RESET}`);
    console.log(`${CYAN}----------------------------------------${RESET}`);
}

async function main() {
    try {
        printBanner();
        console.log(`${GREEN}🚀 Starting Solix Depin Bot...${RESET}`);

        await login();

        await getTotalPoints(true);

        await checkAndClaimTasks();
        taskCheckInterval = setInterval(checkAndClaimTasks, 30 * 60 * 1000); 

        startConnectionQuality();
        
    } catch (error) {
        console.error(`${RED}❌ Error in main process: ${error.message}${RESET}`);
        cleanup();
    }
}

async function login() {
    try {
        console.log(`\n${CYAN}==================== LOGIN ====================${RESET}`);
        console.log(`${YELLOW}🔑 Logging in...${RESET}`);
        
        if (!EMAIL || !PASSWORD) {
            throw new Error('Missing credentials in .env file. Please set SOLIX_EMAIL and SOLIX_PASSWORD');
        }

        const response = await axios.post(LOGIN_URL, {
            email: EMAIL,
            password: PASSWORD
        }, {
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.5',
                'content-type': 'application/json',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'Referer': 'https://dashboard.solixdepin.net/',
                'Referrer-Policy': 'strict-origin-when-cross-origin'
            }
        });

        if (response.data && response.data.result === 'success' && response.data.data.accessToken) {
            token = response.data.data.accessToken;
            userInfo = response.data.data.user;
            
            console.log(`${GREEN}✅ Login successful${RESET}`);
            console.log(`${GREEN}👤 User Info:${RESET}`);
            console.log(`${WHITE}   • User ID: ${userInfo._id}${RESET}`);
            console.log(`${WHITE}   • Email: ${userInfo.email}${RESET}`);
            console.log(`${WHITE}   • Referral Code: ${userInfo.referralCode}${RESET}`);
            if (userInfo.referrerId) {
                console.log(`${WHITE}   • Referrer ID: ${userInfo.referrerId}${RESET}`);
            }

            try {
                const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
                const expiryDate = new Date(payload.exp * 1000);
                console.log(`${YELLOW}🕒 Token expires: ${expiryDate.toLocaleString()}${RESET}`);
            } catch (e) {
                console.log(`${YELLOW}⚠️ Could not parse token expiry: ${e.message}${RESET}`);
            }
            console.log(`${CYAN}===============================================${RESET}`);
            return true;
        } else {
            console.error(`${RED}Login response:${RESET}`, response.data);
            throw new Error('Login failed - Invalid response format');
        }
    } catch (error) {
        console.error(`${RED}❌ Login failed: ${error.message}${RESET}`);
        if (error.response) {
            console.error(`${RED}Error details:${RESET}`, error.response.data);
        }
        throw new Error('Login process failed');
    }
}

async function checkAndClaimTasks() {
    try {
        console.log(`\n${CYAN}==================== TASKS ====================${RESET}`);
        console.log(`${YELLOW}📋 Checking tasks...${RESET}`);

        const tasks = await getTasks();
        if (!tasks || tasks.length === 0) {
            console.log(`${WHITE}ℹ️ No tasks found${RESET}`);
            console.log(`${CYAN}===============================================${RESET}`);
            return;
        }
        
        console.log(`${GREEN}📝 Found ${tasks.length} tasks${RESET}`);

        for (const task of tasks) {
            console.log(`\n${WHITE}▶️ Task: ${task.name} (${task.status}) - ${task.pointAmount} points${RESET}`);
            
            if (task.status === 'idle') {
                console.log(`${YELLOW}🔄 Attempting to claim task: ${task.name}${RESET}`);
                await claimTask(task._id);
            } else if (task.status === 'pending') {
                console.log(`${YELLOW}⏳ Task is pending verification: ${task.name}${RESET}`);
            } else if (task.status === 'claimed') {
                console.log(`${GREEN}✅ Task already claimed: ${task.name}${RESET}`);
            }
        }
        console.log(`${CYAN}===============================================${RESET}`);
        
    } catch (error) {
        console.error(`${RED}❌ Error checking tasks: ${error.message}${RESET}`);
        if (error.response) {
            console.error(`${RED}Error details:${RESET}`, error.response.data);
        }

        if (error.response && error.response.status === 401) {
            console.log(`${YELLOW}🔄 Token expired, logging in again...${RESET}`);
            await login();
        }
    }
}

async function getTasks() {
    try {
        const response = await axios.get(TASKS_URL, {
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.5',
                'authorization': `Bearer ${token}`,
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'Referer': 'https://dashboard.solixdepin.net/',
                'Referrer-Policy': 'strict-origin-when-cross-origin'
            }
        });
        
        return response.data.data || [];
    } catch (error) {
        console.error(`${RED}❌ Error fetching tasks: ${error.message}${RESET}`);
        throw error;
    }
}

async function claimTask(taskId) {
    try {
        const response = await axios.post(CLAIM_TASK_URL, {
            taskId: taskId
        }, {
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.5',
                'authorization': `Bearer ${token}`,
                'content-type': 'application/json',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'Referer': 'https://dashboard.solixdepin.net/',
                'Referrer-Policy': 'strict-origin-when-cross-origin'
            }
        });
        
        if (response.data && response.data.result === 'success') {
            console.log(`${GREEN}✅ Successfully claimed task: ${taskId}${RESET}`);
            return true;
        } else {
            console.log(`${YELLOW}⚠️ Could not claim task: ${taskId}${RESET}`);
            if (response.data) {
                console.log('Response:', response.data);
            }
            return false;
        }
    } catch (error) {
        console.error(`${RED}❌ Error claiming task ${taskId}: ${error.message}${RESET}`);
        if (error.response && error.response.data) {
            console.error(`${RED}Error details:${RESET}`, error.response.data);
        }
        return false;
    }
}

async function getTotalPoints(showDetailedInfo = false) {
    try {
        const response = await axios.get(TOTAL_POINT_URL, {
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.5',
                'authorization': `Bearer ${token}`,
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'Referer': 'https://dashboard.solixdepin.net/',
                'Referrer-Policy': 'strict-origin-when-cross-origin'
            }
        });
        
        if (response.data && response.data.result === 'success' && response.data.data) {
            const pointsData = response.data.data;
            
            if (showDetailedInfo) {
                console.log(`\n${GREEN}💰 Points Information:${RESET}`);
                console.log(`${WHITE}   • Total Points: ${pointsData.total.toFixed(2)}${RESET}`);
                console.log(`${WHITE}   • 🌟 Total Earning Points: ${pointsData.totalEarningPoint.toFixed(2)}${RESET}`);
                console.log(`${WHITE}   • 🔌 Internet Points: ${pointsData.totalPointInternet.toFixed(2)}${RESET}`);
                console.log(`${WHITE}   • ✅ Task Points: ${pointsData.totalPointTask.toFixed(2)}${RESET}`);
                console.log(`${WHITE}   • 👥 Referral Points: ${pointsData.totalPointReferral.toFixed(2)}${RESET}`);
                console.log(`${WHITE}   • 🎁 Bonus Points: ${pointsData.totalPointBonus.toFixed(2)}${RESET}`);
                console.log(`${WHITE}   • 📅 Today's Points: ${pointsData.todayPointEarned.toFixed(2)}${RESET}`);
            } else {
                console.log(`${WHITE}💰 Total Points: ${pointsData.total.toFixed(2)}${RESET}`);
            }
            
            return pointsData;
        }
        console.log(`${YELLOW}⚠️ Invalid points data structure${RESET}`);
        return null;
    } catch (error) {
        console.error(`${RED}❌ Error fetching total points: ${error.message}${RESET}`);
        if (error.response) {
            console.error(`${RED}Error details:${RESET}`, error.response.data);
        }
        return null;
    }
}

function startConnectionQuality() {
    console.log(`\n${CYAN}================ CONNECTION PINGS ================${RESET}`);
    console.log(`${YELLOW}🔌 Starting connection quality pings...${RESET}`);

    stopConnectionQuality();

    pingConnectionQuality();

    connectionQualityInterval = setInterval(pingConnectionQuality, 60 * 1000); 
}

function stopConnectionQuality() {
    if (connectionQualityInterval) {
        clearInterval(connectionQualityInterval);
        connectionQualityInterval = null;
    }
}

async function pingConnectionQuality() {
    try {
        const response = await axios.get(CONNECTION_QUALITY_URL, {
            headers: {
                'accept': 'application/json, text/plain, */*',
                'accept-language': 'en-US,en;q=0.5',
                'authorization': `Bearer ${token}`,
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'cross-site',
                'Referer': 'https://dashboard.solixdepin.net/',
                'Referrer-Policy': 'strict-origin-when-cross-origin'
            }
        });
        
        const now = new Date().toLocaleTimeString();
        if (response.status === 200) {
            console.log(`${GREEN}[${now}] 📡 Connection ping successful${RESET}`);

            await getTotalPoints();
            
            return true;
        } else {
            console.log(`${YELLOW}[${now}] ⚠️ Connection ping received unexpected response: ${response.status}${RESET}`);
            return false;
        }
    } catch (error) {
        console.error(`${RED}[${new Date().toLocaleTimeString()}] ❌ Connection ping failed: ${error.message}${RESET}`);

        if (error.response && error.response.status === 401) {
            console.log(`${YELLOW}🔄 Token expired, logging in again...${RESET}`);
            await login();
        }
        return false;
    }
}

function cleanup() {
    console.log(`${YELLOW}🧹 Cleaning up...${RESET}`);
    stopConnectionQuality();
    if (taskCheckInterval) {
        clearInterval(taskCheckInterval);
        taskCheckInterval = null;
    }
}

process.on('SIGINT', () => {
    console.log(`\n${RED}🛑 Bot shutting down...${RESET}`);
    cleanup();
    process.exit(0);
});

main();