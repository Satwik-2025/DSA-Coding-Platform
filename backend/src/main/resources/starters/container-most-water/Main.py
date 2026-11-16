import sys


def solve(h):
    # Return max over i < j of min(h[i], h[j]) * (j - i).
    # TODO: write your algorithm here
    return 0


def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    h = [int(x) for x in data[1:1 + n]]
    print(solve(h))


main()
