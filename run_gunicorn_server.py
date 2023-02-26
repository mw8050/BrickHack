import os

os.system("python3 -m gunicorn -w 1 -t 0 base:app --worker-class gevent")
