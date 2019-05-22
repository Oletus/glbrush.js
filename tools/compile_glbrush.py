from __future__ import print_function

import subprocess
import os

def js_files_in(root):
    all_files = [os.path.join(root, filename) for filename in os.listdir(root)]
    js_files = [path for path in all_files if path.endswith('.js')]
    return js_files

def glbrush_root_path():
    file_path = os.path.dirname(os.path.abspath(__file__))
    return os.path.abspath(os.path.join(file_path, '..'))

def lib_js():
    '''Returns a list of absolute paths to glbrush js files containing the library.'''
    glbrush_root = glbrush_root_path()
    js_files = js_files_in(glbrush_root)
    return js_files_in(os.path.join(glbrush_root, 'lib')) + js_files

def compile_with_online_compiler(js_code, compilation_level):
    import httplib, urllib

    # Define the parameters for the POST request and encode them in
    # a URL-safe format.

    params = urllib.urlencode([
        ('js_code', js_code),
        ('compilation_level', compilation_level),
        ('output_format', 'text'),
        ('output_info', 'compiled_code'),
      ])

    # Always use the following value for the Content-type header.
    headers = { "Content-type": "application/x-www-form-urlencoded" }
    conn = httplib.HTTPSConnection('closure-compiler.appspot.com')
    conn.request('POST', '/compile', params, headers)
    response = conn.getresponse()
    data = response.read()
    conn.close()
    return data

def compile_brushbench(output_path):
    '''Compile glbrush.js with Closure compiler.
    output_path should include the name of the file.'''
    restore_dir = os.getcwd()
    file_path = os.path.dirname(os.path.abspath(__file__))
    compiler_path = os.path.abspath(os.path.join(file_path, '..', 'node_modules', 'google-closure-compiler-java'))
    lib_js_list = lib_js()
    if not os.path.exists(compiler_path):
        os.mkdir(compiler_path)
    os.chdir(compiler_path)

    if not os.path.exists('compiler.jar'):
        print('Closure compiler not found. Run "npm install" to install it')
        os.chdir(restore_dir)
        return False

    brushbench_js_path = os.path.abspath(os.path.join(file_path, '..', 'benchmark', 'brushbench.js'))
    brushbench_js_path_no_extension = brushbench_js_path[0:-3]

    command = ['java', '-jar', 'compiler.jar', '--compilation_level', 'SIMPLE_OPTIMIZATIONS' ]
    command += ['--js_module_root', glbrush_root_path()]
    command += ['--dependency_mode=STRICT'] # This enables dependency sorting.
    command += ['--entry_point', brushbench_js_path_no_extension]
    command += ['--module_resolution', 'BROWSER']
    command += ['--js']
    command += lib_js_list
    command += [brushbench_js_path]
    command += ['--js_output_file', output_path]
    print(' '.join(command))
    subprocess.call(command)

    os.chdir(restore_dir)
    return True

if __name__ == '__main__':
    compile_brushbench(os.path.join(glbrush_root_path(), 'benchmark', 'brushbench_glbrush_min.js'))
