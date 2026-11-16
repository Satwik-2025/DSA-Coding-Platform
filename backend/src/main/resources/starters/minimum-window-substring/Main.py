import sys


def solve(s, t):
    # Return the shortest (then leftmost) substring of s containing all characters of t, or "" if none.
    # TODO: write your algorithm here
    return ""


def main():
    s = sys.stdin.readline().strip()
    t = sys.stdin.readline().strip()
    print("[" + solve(s, t) + "]")


main()
