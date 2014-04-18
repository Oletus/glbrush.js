import shutil
import os

file_path = os.path.dirname(os.path.abspath(__file__))

dest_path = os.path.join(file_path, '..', '.git', 'hooks')

src_path = os.path.join(file_path, 'pre-commit')

shutil.copy(src_path, dest_path)