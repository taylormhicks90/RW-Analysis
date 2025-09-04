import axios from "axios";
import fs from 'node:fs';
import readline from 'node:readline';
const v2Base = "https://api.torn.com/v2";


export async function getAttacks(ApiKey,war){
    // We will cache results using the war.id
    const cacheFile = `./cache/war-attacks-${war.id}.json`;
    const cacheFileEncoding = 'utf8';
    
    // check for a cached result to avoid uneccesary API calls
    if(fs.existsSync(cacheFile)){
        try{
            const content = fs.readFileSync(cacheFile,cacheFileEncoding);
            const cachedAttacks = JSON.parse(content);
            return cachedAttacks;
        }catch (err)
        {
            console.error('Error reading cache file: ',err);
        }
    }

    let url = v2Base + `/faction/attacks?from=${war.start}&to=${war.end}&limit=100`;
    let hasMore = false;
    let attacksProccessed = [];
    let attacks = [];
    let data = []
    try{
        do{
         const response = await axios.get(url,{
            headers:{"Authorization" : "ApiKey " + ApiKey}
         });
         if(response.data?.error?.code == 5){
            console.log('Rate limit exceeded, pausing for 60 seconds');
            await sleep(60000);
            break;
         }
         data = data.concat(response.data.attacks);
         if(response.data._metadata.links.prev != null){
            hasMore = true;
            url = response.data._metadata.links.prev;
         } else{
            hasMore = false;
         }
        }while(hasMore)
    }catch(error){
        console.error('Error fetching attacks from API',error);
        // unrecoverable at this point, end execution to avoid processing incorrect data.
        process.exit(1);
    }
    
    //filter data to removed duplicate attacks returned from end of API Call
    data.forEach (attack =>{
        if(attacksProccessed.includes(attack.id)) return;
        else{
            attacks.push(attack);
            attacksProccessed.push(attack.id); 
        } 
    });
    
    //try and write a cache file, if this fails we will recover and continue processing the attacks without saving to a cache
    try{
        fs.writeFileSync(cacheFile,JSON.stringify(attacks),cacheFileEncoding);
    }catch (err){
        console.error('Error writing cache file',err)
    }

    return attacks;
}
export async function getWars(ApiKey) {
    const url = v2Base + '/faction/rankedwars?sort=DESC';
    const response = await axios.get(url,{
        headers :{"Authorization" : "ApiKey " + ApiKey }
    });
    return response.data.rankedwars;
}

export async function getLastRankedWar(ApiKey) {
    const wars = await getWars(ApiKey);
    return wars[0];
}

export async function ensureMemberExistsInResults(results,member) {
    if (!results[member.id]) {
        results[member.id] = {member:member, attacks: 0, defends: 0,assists:0, points_gained: 0, points_lost: 0, outside_hits:0, outside_chain: 0, chain_bonus: 0};
    }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function askQuestion(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }))
}