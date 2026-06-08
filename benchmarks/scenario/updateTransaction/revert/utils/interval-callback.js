'use strict';

/**
 * Interval callback to add waiting time between rounds
 * This helps reduce node load and provides proper spacing between test phases
 */

/**
 * Callback function that waits for specified interval
 * @param {object} context - The benchmark context
 * @param {object} args - The callback arguments including interval time
 * @returns {Promise} Promise that resolves after the interval
 */
module.exports.callback = async function(context, args) {
    const intervalMs = args.interval || 10000; // Default 10 seconds for revert tests
    const intervalSec = intervalMs / 1000;
    
    console.log(`\n=== Starting ${intervalSec}s interval to reduce node load (Logical Delete Test) ===`);
    
    return new Promise(resolve => {
        setTimeout(() => {
            console.log(`=== Interval completed, resuming logical delete operations ===\n`);
            resolve();
        }, intervalMs);
    });
};