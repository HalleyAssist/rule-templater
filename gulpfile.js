const gulp = require('gulp');
const fs = require('fs');
const path = require('path');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');

// Task to build production files (replaces bin/package.js)
gulp.task('build-production', function(done) {
    try {
        let counter = 0;
        let replacements = {};
        
        const ParserRules = require('./src/RuleParser.ebnf.js');
        
        // Use counter-based approach instead of random strings for guaranteed uniqueness
        const originalToJSON = RegExp.prototype.toJSON;
        RegExp.prototype.toJSON = function(){
            const placeholder = `__REGEXP_PLACEHOLDER_${counter++}__`;
            replacements[placeholder] = this;
            return placeholder;
        };

        let rules = JSON.stringify(ParserRules);
        
        // Restore original toJSON to avoid side effects
        RegExp.prototype.toJSON = originalToJSON;
        
        for(const key in replacements){
            rules = rules.replace(`"${key}"`, replacements[key].toString());
        }

        fs.writeFileSync('src/RuleParser.production.ebnf.js', "module.exports="+rules);

        const ruleParserJs = fs.readFileSync('src/RuleParser.js', 'utf8');
        const ruleParserJsFixed = ruleParserJs
            .replace("require('./RuleParser.ebnf.js')", 'require(\'./RuleParser.production.ebnf.js\')')

        fs.writeFileSync('src/RuleParser.production.js', ruleParserJsFixed);
        
        console.log('Production build complete');
        done();
    } catch (error) {
        console.error('Error during production build:', error.message);
        done(error);
    }
});

// Task to build browser version with browserify and deassertify
// Note: This task requires production files to exist. Run 'gulp build' or 'gulp build-production' first.
gulp.task('build-browser', function() {
    // Check if production files exist
    if (!fs.existsSync('./src/RuleParser.production.js')) {
        console.error('Error: Production files not found. Run "gulp build-production" first.');
        return Promise.reject(new Error('Production files not found'));
    }
    
    return browserify({
        entries: path.resolve(__dirname, 'src/RuleParser.browser.js'),
        standalone: 'RuleParser'
    })
    .transform('unassertify')
    .bundle()
    .pipe(source('rule-parser.browser.js'))
    .pipe(buffer())
    .pipe(gulp.dest('./dist'));
});

// Default task to build both
gulp.task('build', gulp.series('build-production', 'build-browser'));

// Export default
gulp.task('default', gulp.task('build'));
