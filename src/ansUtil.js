var natural = require('natural');

const ANSWER_CORRECT_MIN_DIST_THERSHOLD = 0.95;
const ANSWER_POSSIBLE_MIN_DIST_THERSHOLD = 0.75;

function ansDistMap(answers, userAnswer, correct_min_thershold = ANSWER_CORRECT_MIN_DIST_THERSHOLD, possible_min_thershold = ANSWER_POSSIBLE_MIN_DIST_THERSHOLD){
    let possibleAnswers = answers.map(ans=>{
        return { text: ans, dist: natural.JaroWinklerDistance(ans, userAnswer) };
    }).filter(entry=>{
        return entry.dist >= possible_min_thershold;
    }).sort(function(a,b){
        return b.dist - a.dist;
    });

    //case 1: single exact match answer => done
    //case 2: single correct answer => done
    //case 3: multiple possible answers =>need further query
    //default: no answers found
    if (possibleAnswers.length>=1){
        if (possibleAnswers[0].dist === 1){
            return [possibleAnswers[0]];
        } else if (possibleAnswers.filter(entry=>entry.dist >= correct_min_thershold).length === 1){
            return [possibleAnswers[0]];
        } else {
            return possibleAnswers;
        }
    } else {
        return [];
    }
}

module.exports = {
    ansDistMap: ansDistMap
}