import sys
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(script_dir, 'dependencies'))
sys.path.insert(0, script_dir)

from run import app

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=False)
