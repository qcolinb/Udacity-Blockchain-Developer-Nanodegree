/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');
const hex2ascii = require('hex2ascii');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        return new Promise(async (resolve, reject) => {
            // Obtain chain length 
            let height = this.chain.length;
            block.height = height;
            // Obtain block time
            block.time = new Date().getTime().toString().slice(0,-3);
            // If chain exists, take previous block's hash
            block.previousBlockHash = (height > 0) ? this.chain[height - 1].hash : null;
            // Hash block 
            block.hash = await SHA256(JSON.stringify(block)).toString();
            // Check that block is valid
            const validBlock = block.hash && (block.height === this.chain.length) && block.time;
            // Resolve promise
            validBlock ? resolve(block) : reject(new Error("Invalid Block"));
        })
        .then(block => {
            // Push block to chain
            this.chain.push(block);
            // Update chain length (Blockchain length is always chain length - 1)
            this.height = this.chain.length - 1;
            return block;
        })
        .catch(error => console.log("[ERROR]", error));
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        // let self = this;
        return new Promise((resolve) => {
            resolve(`${address}:${new Date().getTime().toString().slice(0,-3)}:starRegistry`);           
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Verify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        // Validating the chain prior to block addition
        this.validateChain().then(error => typeof error === 'string' ? console.log("Chain is OK") : console.log("Error: ", error));
        return new Promise(async (resolve, reject) => {
            // Get time from message
            let messageTime = parseInt(message.split(':')[1]);
            // Get current time
            let currentTime = parseInt(new Date().getTime().toString().slice(0,-3));
            // Check that message has been signed within the last 5 minutes
            if((currentTime - messageTime) >= (5 * 60)) reject(new Error("Request timed out"));
            // Verify block using library
            if (!bitcoinMessage.verify(message, address, signature)) reject(new Error("Failed Verification"));
            // Create new block
            let block = new BlockClass.Block(star);
            // Add the owner to the block 
            block.owner = address;
            // Add the block to the chain
            block = await this._addBlock(block);
            resolve(block);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        // let self = this;
        return new Promise((resolve, reject) => {
            for (i=0; i<this.chain.length; i++) {
                if(this.chain[i].hash === hash) return(this.chain[i])
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        // let self = this;
        return new Promise((resolve, reject) => {
            let block = this.chain.filter(p => p.height === height)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        let stars = [];
        return new Promise((resolve, reject) => {
            let i;
            for (i=0; i<this.chain.length; i++) {
                if (this.chain[i].owner === address) {
                    stars.push(JSON.parse(hex2ascii(this.chain[i].body)));
                }
            }
            stars.length > 0 ? resolve(stars) : reject(new Error("No stars found for this account"));            
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let errorLog = [];
        return new Promise(async (resolve, reject) => {
            for (let block of this.chain) {
                if (block.validate()) {
                    if (block.height > 0) {
                        if(block.previousBlockHash !== this.chain[block.height - 1].hash) {
                            errorLog.push(new Error("Invalid link between " + block.height + "and " + this.chain[block.height - 1].height));
                        }
                    }
                } else {
                    errorLog.push(new Error("Invalid block: " + block.height + ", " + block.hash));
                }
            }
            errorLog.length > 0 ? resolve(errorLog) : resolve("No errors found")
        });
    }

}

module.exports.Blockchain = Blockchain;   