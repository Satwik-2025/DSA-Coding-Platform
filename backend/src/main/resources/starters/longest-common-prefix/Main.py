import sys


def solve(words):
    # Return the longest prefix shared by every word (possibly "").
    # TODO: write your algorithm here
    return ""


def main():
    n = int(sys.stdin.readline())
    words = [sys.stdin.readline().rstrip("\r\n") for _ in range(n)]
    # Brackets make an empty answer visible in the output.
    print("[" + solve(words) + "]")


main()
