import 'dotenv/config';
import fs from 'node:fs';

import { ensureMemberExistsInResults, getAttacks, getLastRankedWar, getWars, askQuestion} from "./functions.js";

const API_KEY = process.env.API_KEY;
const FACTION_ID = Number(process.env.FACTION_ID);

let war = null;

let lastInput = null;

lastInput = await askQuestion('Process Last War? [Y/N]');

if (lastInput.toLowerCase == 'y') war = await getLastRankedWar(API_KEY);
else{
    const wars = await getWars(API_KEY);
    for(let index in wars){
        console.log(`[${index}] - ${wars[index].factions[0].name} vs ${wars[index].factions[1].name}`);
    }
    lastInput = await askQuestion('Select War: ');
    war = wars[lastInput];
}




let faction = null
let opposingFaction = null;

war.factions.forEach( data =>{
    if(data.id == FACTION_ID) faction = data;
    else opposingFaction = data;
})


const outputFile = `./outputs/${faction.name} vs ${opposingFaction.name} - ${war.id}.csv`;
const attacks = await getAttacks(API_KEY,war);

let results = {};


attacks.forEach(attack => {
    let type = null;
    let member = null;
    
    try{ 
        //skip this attack if its not a ranked war hit, originnally didn't count outside hits
        //if(attack.is_ranked_war == false) return;
        
        //determing attack vs defend
        if(attack?.attacker?.faction?.id == FACTION_ID) type = "attack";
        else if(attack?.defender.faction.id == FACTION_ID) type = "defend";
        
        // debugging artifact, shouldn't trigger but leaving in incase it ever outputs something
        else{
            console.log("Unable to classify attack");
            console.log(attack);
            return;
        }
        
        //process results
        switch (type) {
            case "attack":
                member = attack.attacker;
                ensureMemberExistsInResults(results,member);
                // tally war hits
                if(attack.is_ranked_war){
                    results[member.id].attacks += 1;
                    results[member.id].points_gained += attack.respect_gain;
                }
                //tally war Assists
                else if(attack.results == "Assist" && attack.defender.faction.id == opposingFaction.id) {
                        results[member.id].assists += 1;
                        console.log(attack);
                }
                //Tally outside chain hits
                else if (attack.is_ranked_war == false && attack.chain >= 10 && attack.result != "Lost"){
                    results[member.id].outside_chain += 1;
                }
                //tally outside hits
                else{
                    results[member.id].outside_hits += 1;
                }
                break;

            case "defend":
                member = attack.defender;
                ensureMemberExistsInResults(results,member);
                if(attack.is_ranked_war){
                    results[member.id].defends += 1;
                    results[member.id].points_lost += attack.respect_gain;
                }
                break;
            
            default:
                break;
        }
    }catch(error){
        console.log(error);
        console.log(attack);
    }
});

//Output to terminal as comma seperated values to copy and paste to excel

if(fs.existsSync(outputFile)) fs.unlinkSync(outputFile,()=>{});
fs.writeFileSync(outputFile,'ID,Name,Attacks,Defends,Assists,Outside Hits,Outside Chain Hits,Points Gained,Points Lost,Net Points\n',{encoding: 'utf-8', flag:'a'})
//console.log('ID,Name,Attacks,Defends,Assists,Outside Hits,Outside Chain Hits,Points Gained,Points Lost,Net Points');
for (let id in results){
    let member = results[id];
    fs.writeFileSync(outputFile,`${member.member.id},${member.member.name},${member.attacks},${member.defends},${member.assists},${member.outside_hits},${member.outside_chain},${member.points_gained},${member.points_lost},${member.points_gained - member.points_lost}\n`,{encoding: 'utf-8', flag:'a'});
}


