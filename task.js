require('dotenv').config();
const axios = require('axios');

const EMAIL = process.env.SOLIX_EMAIL;
const PASSWORD = process.env.SOLIX_PASSWORD;

const BASE_URL = 'https://api.solixdepin.net/api';
const LOGIN_URL = `${BASE_URL}/auth/login-password`;
const TASKS_URL = `${BASE_URL}/task/get-user-task`;
const CLAIM_TASK_URL = `${BASE_URL}/task/claim-task`;
const TOTAL_POINT_URL = `${BASE_URL}/point/get-total-point`;

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";
const WHITE = "\x1b[37m";
const CYAN = "\x1b[36m";

let token = null;
let userInfo = null;
let isRunning = true;

function printBanner() {
    console.log(`${CYAN}----------------------------------------${RESET}`);
    console.log(`${CYAN}  Solix Force Auto Task - Airdrop Insiders ${RESET}`);
    console.log(`${CYAN}----------------------------------------${RESET}`);
}

async function main() {
    try {
        printBanner();
        console.log(`${GREEN}🚀 Starting Solix Auto Task..${RESET}`);

        const loginSuccess = await login();
        if (!loginSuccess) {
            console.error(`${RED}❌ Login failed. Exiting program.${RESET}`);
            process.exit(1);
        }

        await getTotalPoints(true);

        console.log(`${GREEN}🔄 Starting continuous force claiming cycle (10-second intervals)${RESET}`);
        console.log(`${YELLOW}⚠️ Press Ctrl+C to stop the script${RESET}`);
        console.log(`${GREEN}🔍 This script will attempt to claim ALL tasks in every cycle${RESET}`);

        await runTaskClaimingLoop();
        
    } catch (error) {
        console.error(`${RED}❌ Error in main process: ${error.message}${RESET}`);
        process.exit(1);
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
        return false;
    }
}

async function runTaskClaimingLoop() {
    let loopCount = 1;
    
    while (isRunning) {
        console.log(`\n${CYAN}============== CYCLE #${loopCount} ==============${RESET}`);
        const timestamp = new Date().toLocaleTimeString();
        console.log(`${WHITE}⏱️ Time: ${timestamp}${RESET}`);
        
        try {
            await forceClaimAllTasks();

            await getTotalPoints(false);
            
        } catch (error) {
            console.error(`${RED}❌ Error in cycle #${loopCount}: ${error.message}${RESET}`);

            if (error.response && error.response.status === 401) {
                console.log(`${YELLOW}🔄 Token expired, logging in again...${RESET}`);
                await login();
            }
        }
        
        console.log(`${YELLOW}⏳ Waiting 10 seconds before next cycle...${RESET}`);
        await sleep(10000); 
        loopCount++;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function forceClaimAllTasks() {
    try {
        console.log(`${YELLOW}📋 Getting all tasks...${RESET}`);

        const tasks = await getTasks();
        if (!tasks || tasks.length === 0) {
            console.log(`${WHITE}ℹ️ No tasks found${RESET}`);
            return;
        }
        
        console.log(`${GREEN}📝 Found ${tasks.length} tasks${RESET}`);

        const idleTasks = tasks.filter(task => task.status === 'idle');
        const pendingTasks = tasks.filter(task => task.status === 'pending');
        const claimedTasks = tasks.filter(task => task.status === 'claimed');
        
        console.log(`${WHITE}📊 Task Status: ${GREEN}${claimedTasks.length} claimed${RESET}, ${YELLOW}${pendingTasks.length} pending${RESET}, ${CYAN}${idleTasks.length} idle${RESET}`);

        console.log(`${GREEN}🔄 Force claiming ALL ${tasks.length} tasks${RESET}`);
        
        let successCount = 0;
        let failedCount = 0;

        for (const task of tasks) {
            let statusColor = task.status === 'claimed' ? GREEN : 
                             (task.status === 'pending' ? YELLOW : CYAN);
            
            console.log(`${WHITE}▶️ Attempting to claim: ${task.name} (${statusColor}${task.status}${RESET}) - ${task.pointAmount} points${RESET}`);
            
            const claimResult = await claimTask(task._id);
            
            if (claimResult) {
                console.log(`${GREEN}✅ Claim attempt successful: ${task.name}${RESET}`);
                successCount++;
            } else {
                console.log(`${YELLOW}⚠️ Claim attempt ignored: ${task.name}${RESET}`);
                failedCount++;
            }
            
            await sleep(2000);
        }
        
        console.log(`${GREEN}📈 Claim attempt summary: ${successCount} succeeded, ${failedCount} ignored${RESET}`);
        
    } catch (error) {
        console.error(`${RED}❌ Error claiming tasks: ${error.message}${RESET}`);
        throw error;
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
            return true;
        } else {
            return false;
        }
    } catch (error) {
        if (error.response && error.response.status !== 400) {
            console.error(`${RED}❌ Unexpected error claiming task ${taskId}: ${error.message}${RESET}`);
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
                console.log(`${WHITE}💰 Total Points: ${pointsData.total.toFixed(2)} (Today: ${pointsData.todayPointEarned.toFixed(2)})${RESET}`);
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

process.on('SIGINT', () => {
    console.log(`\n${RED}🛑 Bot shutting down...${RESET}`);
    isRunning = false;
    console.log(`${YELLOW}👋 Thank you for using Solix Force Claimer!${RESET}`);
    process.exit(0);
});

main();