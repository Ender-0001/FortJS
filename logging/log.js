module.exports = {
    Log(data) {
        console.log('[\x1b[35;1mFortJS\x1b[0m]', data, '\x1b[0m')
    },
    Error(data) {
        console.error('[\x1b[31mFortJS\x1b[0m]\x1b[31m', data, '\x1b[0m')
    },
    warn(data, showtype = true) {
        console.warn('[\x1b[33mFortJS\x1b[0m]\x1b[33m', data, '\x1b[0m')
    }
}