const { expect } = require('chai');
const { HalleyFunctionBlob } = require('../index');

describe('HalleyFunctionBlob', function() {
    const functionBlobData = {
        _schema: 1,
        version: 'v0.0.0-dev',
        functions: [
            {
                name: 'ArrayIn',
                arguments: ['haystack', 'needle?']
            },
            {
                name: 'StrConcat',
                arguments: ['...']
            },
            {
                name: 'TimeDelay',
                arguments: ['delay']
            }
        ]
    };

    it('stores normalized function definitions from JSON data', function() {
        const blob = new HalleyFunctionBlob(functionBlobData);

        expect(blob._schema).to.equal(1);
        expect(blob.version).to.equal('v0.0.0-dev');
        expect(blob.functions).to.deep.equal(functionBlobData.functions);
    });

    it('warns when a function does not exist', function() {
        const blob = new HalleyFunctionBlob(functionBlobData);

        expect(blob.validate('MissingFunction')).to.deep.equal([
            "function 'MissingFunction' does not exist"
        ]);
    });

    it('warns when required parameters are missing', function() {
        const blob = new HalleyFunctionBlob(functionBlobData);

        expect(blob.validate('ArrayIn')).to.deep.equal([
            "parameter 1 of ArrayIn 'haystack' is missing, function expects 1 to 2 parameters"
        ]);
    });

    it('warns when too many parameters are provided', function() {
        const blob = new HalleyFunctionBlob(functionBlobData);

        expect(blob.validate('TimeDelay', ['5 minutes', 'extra'])).to.deep.equal([
            'TimeDelay received 2 parameters, function expects 1 parameter'
        ]);
    });

    it('accepts optional and variadic parameter counts', function() {
        const blob = new HalleyFunctionBlob(functionBlobData);

        expect(blob.validate('ArrayIn', [['one', 'two']])).to.deep.equal([]);
        expect(blob.validate('ArrayIn', [['one', 'two'], 'one'])).to.deep.equal([]);
        expect(blob.validate('StrConcat', ['a', 'b', 'c'])).to.deep.equal([]);
    });

    it('loads and constructs a blob via fetch', async function() {
        const originalFetch = global.fetch;

        global.fetch = async (url) => ({
            ok: true,
            json: async () => Object.assign({ requestedUrl: url }, functionBlobData)
        });

        try {
            const blob = await HalleyFunctionBlob.fromURL('https://example.com/functions.json');

            expect(blob).to.be.instanceOf(HalleyFunctionBlob);
            expect(blob.functions).to.deep.equal(functionBlobData.functions);
        } finally {
            global.fetch = originalFetch;
        }
    });
});
