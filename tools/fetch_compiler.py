from __future__ import print_function

zip_url = 'https://closure-compiler.googlecode.com/files/compiler-20131014.zip'
zip_sha = '0e354ddd3559d2e6c60fb10a7defa35fd0a365fd'
jar_sha = 'a081823a172fd5640c38323ae83fa14a6bb9c589'

import os

def sha1_of_file(filepath):
    import hashlib
    if not os.path.exists(filepath):
        return ''
    with open(filepath, 'rb') as f:
        return hashlib.sha1(f.read()).hexdigest()

def fetch_compiler(target_path):
    import urllib
    import zipfile
    zippath = 'compiler.zip'
    if hasattr(urllib, 'urlretrieve'):
        # Python 2
        urllib.urlretrieve(zip_url, zippath)
    else:
        # Python 3
        import urllib.request
        urllib.request.urlretrieve(zip_url, zippath)
    if sha1_of_file(zippath) != zip_sha:
        if os.path.exists(zippath):
            os.remove(zippath)
        print('compiler.jar missing and unable to download compiler.zip.')
        print('Download Closure compiler manually.')
        return False
    with zipfile.ZipFile(zippath) as z:
        if 'compiler.jar' in z.namelist():
            with open(target_path, 'wb') as f:
                f.write(z.read('compiler.jar'))
    os.remove(zippath)
    if sha1_of_file(target_path) != jar_sha:
        if os.path.exists(target_path):
            os.remove(target_path)
        print('compiler.jar missing and unable to extract compiler.jar from downloaded compiler.zip.')
        print('Download Closure compiler manually.')
        return False
    return True
