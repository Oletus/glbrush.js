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
    '''Returns a list of absolute paths to glbrush js files containing the library.
    Files are sorted in dependency order.'''
    glbrush_root = glbrush_root_path()
    js_files = js_files_in(glbrush_root)
    def client_js_key(path):
        # This hardcoded dependency order is a bit ugly, could perhaps be replaced with better dependency management.
        if path.count('util') > 0:
            return 'A' + path
        if path.count('rasterize_shader') > 0:
            return 'B' + path
        return 'C' + path
    js_files = sorted(js_files, key=client_js_key)
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

def compile_glbrush(output_path):
    '''Compile glbrush.js with Closure compiler.
    output_path should include the name of the file.'''
    file_path = os.path.dirname(os.path.abspath(__file__))
    lib_js_list = lib_js()

    lib_js_code = ""
    for js_file in lib_js_list:
        source_file = open(js_file, "r")
        lib_js_code += source_file.read()
        source_file.close()

    # Compile a package that's usable within another app, so WHITESPACE_ONLY
    compiled_code = compile_with_online_compiler(lib_js_code, 'WHITESPACE_ONLY')
    output_file = open(output_path, "w")
    output_file.write(compiled_code)
    output_file.close()

    return True

if __name__ == '__main__':
    compile_glbrush(os.path.join(glbrush_root_path(), 'benchmark', 'glbrush_min.js'))
