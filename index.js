const randomChar = require('random-char');
const randomItem = require('random-item');
const randomInt = require('random-int');
const axios = require('axios');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const config = require('./config.json');

const { steps, errors, users, urls, data } = config.errors;

const MINUTE = 60 * 1000;
const TIMEOUT = randomInt(steps.timeout.min, steps.timeout.max) * MINUTE;
const COUNT = steps.count;


function generateCode() {
    const codeDefinitions = [
        'number',
        'upper',
        'upper',
        'upper',
        'upper',
        'upper',
        'number',
        'upper'
    ];

    const code = codeDefinitions
        .map(def => randomChar(def))
        .join('');

    return code;
}

function serializeData(data) {
    return Object.getOwnPropertyNames(data)
        .map(name => ({
            name: name,
            value: data[name]
        }))
        .filter(({ value }) => !!value)
        .map(({ name, value }) => ({
            name: encodeURIComponent(name),
            value: encodeURIComponent(value).replace(/%20/g, '+')
        }))
        .map(({ name, value }) => name + '=' + value)
        .join('&');
};

async function postForm(url, code, userData) {
    const data = {
        form_name: 'registration-form',
        code: code,
        ...userData,
        i_agree: '1',
        i_agree_with_privacy_policy: '1'
    };

    const options = {
        method: 'post',
        url: url,
        data: serializeData(data),
        responseType: 'json'
    };

    const response = await axios(options);
    console.log(response.data);

    return response.data;
}

async function validateCode(code, userData) {
    const url = urls.validate;

    return postForm(url, code, userData);
}

async function registerCode(code, userData) {
    const url = urls.register;

    return postForm(url, code, userData);
}

async function submit() {
    const userData = randomItem(users);
    const code = generateCode();

    const submition = {
        user: userData.name,
        code: code,
        validate: '',
        register: ''
    };

    const validationResult = await validateCode(code, userData);
    if (validationResult.error) {
        submition.validate = validationResult.messages;
    }

    if (!validationResult.error || validationResult.messages.indexOf(errors.used) < 0) {
        const registerResult = await registerCode(code, userData);
        submition.register = registerResult && registerResult.code;
    }

    return submition;
}

async function save(submition) {
    const csvWriter = createCsvWriter({
        path: data.submitions,
        header: [
            { id: 'user', title: 'User' },
            { id: 'code', title: 'Code' },
            { id: 'validate', title: 'Validate' },
            { id: 'register', title: 'Register' }
        ],
        append: true,
    });

    const records = [submition];

    return csvWriter.writeRecords(records);
}

async function step() {
    const submition = await submit();

    await save(submition);

    return submition;
}

async function run(count, timeout, running, errors) {
    errors = errors || 0;

    if (count <= 0) {
        console.log('Errors', errors);

        return;
    }

    running = running || false;
    const currentTimeout = running ? timeout : 0;

    setTimeout(async () => {
        console.log('>', count);
        var stepResult = await step();

        if (!stepResult.register || stepResult.register.toLowerCase() !== 'ok') {
            errors++;
            console.log('> error', stepResult);
        }

        run(count - 1, timeout, true, errors);
    }, currentTimeout);
}

console.log('Count', COUNT);
console.log('Timeout', TIMEOUT / MINUTE);

// (async () => await run(COUNT, TIMEOUT))();
(async () => await step())();

