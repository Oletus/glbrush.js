import subprocess
import os

def lib_scripts_from_config():
    configfile = open('glbrushscripts.txt')
    jsfiles = []
    for line in configfile.readlines():
        if not line.startswith('#') and line.strip() != '':
            jsfiles.append(os.path.join('..', line.strip()))
    configfile.close()
    return jsfiles

# Compile a package that's usable within another app, so WHITESPACE_ONLY
command = ['java', '-jar', 'compiler.jar', '--compilation_level', 'WHITESPACE_ONLY', '--js']
command += lib_scripts_from_config()
command += ['--js_output_file', 'glbrush_min.js']
print ' '.join(command)
subprocess.call(command)