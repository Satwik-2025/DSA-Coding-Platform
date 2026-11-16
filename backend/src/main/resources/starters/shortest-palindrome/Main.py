import sys


def solve(s):
    # Return the shortest palindrome that ends with s (characters are only added in front).
    # TODO: write your algorithm here
    return s


def main():
    # A missing line (end of input) counts as an empty string.
    s = sys.stdin.readline().rstrip("\r\n")
    # Brackets make an empty answer visible in the output.
    print("[" + solve(s) + "]")


main()
