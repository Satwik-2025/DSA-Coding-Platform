import sys


def solve(s):
    # Return True if every bracket is closed by the same type in the right order.
    # TODO: write your algorithm here
    return False


def main():
    # A missing line (end of input) counts as an empty string.
    s = sys.stdin.readline().rstrip("\r\n")
    print("true" if solve(s) else "false")


main()
