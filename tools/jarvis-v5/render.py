"""Compatibility entry for generated human views. Uses the owning V5 generator."""
import argparse,json
from pathlib import Path
from generate import generate
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--root',type=Path,required=True);p.add_argument('--managed',action='store_true');a=p.parse_args()
    print(json.dumps(generate(a.root.resolve(),a.managed),indent=2))
