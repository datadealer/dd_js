/*global module:false*/
module.exports = function(grunt) {

  grunt.initConfig({
    param: {
      name: 'dd',
      views: 'scripts/views.js'
    },
    pkg: grunt.file.readJSON('package.json'),
    meta: {
      banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
    },
    'git-describe': {
      options: {
        prop: 'buildId'
      },
      app: []
    },
    copy: {
      app: {
        files: [
          {src: 'components/sockjs/sockjs.min.js', dest: 'dist/sockjs-0.3.4.min.js'},
          {src: 'components/sockjs/sockjs.min.js', dest: './sockjs-0.3.4.min.js'},
          {src: 'img/**', dest: 'dist/'},
          {src: 'font/**', dest: 'dist/'},
          {src: 'i18n/*.json', dest: 'dist/'}
        ]
      }
    },
    requirejs: {
      loader: {
        options: {
          baseUrl: 'scripts',
          name: '../components/almond/almond',
          include: ['bootstrap'],
          mainConfigFile: 'scripts/require.config.js',
          out: 'dist/scripts/<%= param.name %>_loader.js',
          optimize: 'none', // We are using grunt-contrib-uglify until this issue is fixed in RequireJS: https://github.com/jrburke/requirejs/issues/962
          findNestedDependencies: true,
          generateSourceMaps: true,
          preserveLicenseComments: false
        }
      },
      core: {
        options: {
          baseUrl: 'scripts',
          name: '../components/almond/almond',
          include: ['core'],
          mainConfigFile: 'scripts/require.config.js',
          out: 'dist/scripts/<%= param.name %>_core.js',
          optimize: 'uglify2',
          findNestedDependencies: true,
          generateSourceMaps: true,
          preserveLicenseComments: false
        }
      }
    },
    concat: {
      css: {
        src: ['css/*.css'],
        dest: 'dist/css/<%= param.name %>.css'
      }
    },
    'string-replace': {
      app: {
        files: {
          'dist/index.html': 'index.html'
        },
        options: {
          replacements: [{
            pattern: /<!-- #grunt-begin-replace-header -->[\s\S]*<!-- #grunt-end-replace-header -->/m,
            replacement: '<link rel="stylesheet" type="text/css" href="css/<%= param.name %>.min.css" />\n    <script src="scripts/dd_loader.js"></script>'
          }, {
            pattern: /<!-- #grunt-build-id -->/,
            replacement: '<%= buildId %> <%= grunt.template.today("isoDateTime") %>'
          }]
        }
      }
    },
    min: {
      loader: {
        src: ['<%= requirejs.loader.options.out %>'],
        dest: 'dist/scripts/loader.min.js'
      }
    },
    cssmin: {
      css: {
        files: {
          'dist/css/<%= param.name %>.min.css': ['<%= concat.css.dest %>']
        }
      }
    },
    yuidoc: {
      compile: {
        name: '<%= param.name %>',
        description: '<%= pkg.description %>',
        version: '<%= pkg.version %>',
        url: '<%= pkg.homepage %>',
        options: {
          paths: 'scripts',
          exclude: 'vendor',
          outdir: 'docs/api'
        }
      }
    },
    docco: {
      app: {
        src: ['scripts/*.js'],
        options: {
          output: 'docs/'
        }
      }
    },
    jst: { // Currently not in use; templates are compiled by the RequireJS `tpl` plug-in.
      app: {
        options: {
          templateSettings: {
            variable: 'D'
          },
          amdWrapper: true,
          namespace: 'views',
          prettify: true,
          processName: function(name) {
            return name.substr(name.indexOf('/') + 1);
          }
        },
        files: {
          "<%= param.views %>": ["views/**/*.html"]
        }
      }
    },
    watch: {
      files: '<%= lint.files %>',
      tasks: 'lint qunit'
    },
    qunit: {
      files: ['http://datadealer/test/dd_js_test_example.html']
    },
    jshint: {
      files: {
        src: [
          'Gruntfile.js',
          'scripts/*.js',
          //'test/**/*.js',
          '!scripts/setup_local.js',
          '!scripts/*test*.js'
        ]
      },
      options: {
        jshintrc: '.jshintrc'
      }
    },
    server: {
      port: 8003,
      base: '.'
    },
    uglify: {
      loader: {
        src: ['<%= requirejs.loader.options.out %>'],
        dest: 'dist/scripts/<%= param.name %>_loader.min.js'
      }
    },
    shell: {
      xgettext: {
        command: 'xgettext --force-po --language=Python --from-code=UTF-8 --copyright-holder="<%= pkg.author %>" --package-name="<%= pkg.title || pkg.name %>" --package-version="<%= pkg.version %>" --msgid-bugs-address=inout@datadealer.com -k_._ -k__:1,2 -o i18n/messages.pot scripts/*.js views/*.html'
      },
      msginit: {
        command: 'msginit -i i18n/messages.pot -o i18n/en_US.po -l en_US --no-translator; msginit -i i18n/messages.pot -o i18n/de_AT.po -l de_AT --no-translator'
      },
      msgmerge: {
        command: 'msgmerge -U --backup=none i18n/en_US.po i18n/messages.pot; msgmerge -U i18n/de_AT.po i18n/messages.pot'
      }
    },
    po2json: {
      all: {
        src: ['i18n/*.po'],
        dest: 'i18n/'
      }
    },
    preload_assets: {
      app: {
        options: {
          ignoreBasePath: 'dist/',
          template: 'preloadjs'
        },
        files: {
          'dist/scripts/asset-manifest.js': ['dist/css/dd.min.css', 'dist/font/*', 'dist/i18n/*', 'dist/img/*', 'dist/scripts/dd.js']
        }
      }
    },
    clean: {
      dist: ['dist']
    }
  });

  grunt.loadNpmTasks('grunt-bower');
  grunt.loadNpmTasks('grunt-contrib-clean');
  grunt.loadNpmTasks('grunt-contrib-concat');
  grunt.loadNpmTasks('grunt-contrib-copy');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-jst');
  grunt.loadNpmTasks('grunt-contrib-less');
  grunt.loadNpmTasks('grunt-contrib-cssmin');
  grunt.loadNpmTasks('grunt-contrib-requirejs');
  grunt.loadNpmTasks('grunt-contrib-uglify');
  grunt.loadNpmTasks('grunt-contrib-yuidoc');
  grunt.loadNpmTasks('grunt-devtools');
  grunt.loadNpmTasks('grunt-docco');
  grunt.loadNpmTasks('grunt-git-describe');
  grunt.loadNpmTasks('grunt-po2json');
  grunt.loadNpmTasks('grunt-preload-assets');
  grunt.loadNpmTasks('grunt-shell');
  grunt.loadNpmTasks('grunt-string-replace');

  grunt.registerTask('default', [
    'clean',
    'po2json',
    'copy',
    'concat',
    'cssmin',
    'preload_assets',
    'requirejs',
    'uglify',
    'git-describe',
    'string-replace'
  ]);
  grunt.registerTask('messages', ['shell:xgettext', 'shell:msgmerge'])
  grunt.registerTask('core', ['cssmin', 'requirejs:core'])
  grunt.registerTask('test', ['server', 'qunit']);
  grunt.registerTask('docs', ['docco', 'yuidoc']);
  grunt.registerTask('debug', []);
};
