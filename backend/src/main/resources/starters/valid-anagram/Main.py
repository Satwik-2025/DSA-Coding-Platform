import sys


def solve(s, t):
    # Return True if t is a rearrangement of s.
    # TODO: write your algorithm here
    return False


def main():
    # A missing line (end of input) counts as an empty string.
    s = sys.stdin.readline().rstrip("\r\n")
    t = sys.stdin.readline().rstrip("\r\n")
    print("true" if solve(s, t) else "false")


main()
