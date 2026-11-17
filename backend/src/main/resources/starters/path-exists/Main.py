import sys


def solve(n, roads, s, t):
    # Return True if s and t are connected through two-way roads. Places are numbered 1..n.
    # TODO: write your algorithm here
    return False


def main():
    data = sys.stdin.buffer.read().split()
    n, m = int(data[0]), int(data[1])
    roads = [(int(data[2 + 2 * i]), int(data[3 + 2 * i])) for i in range(m)]
    s, t = int(data[2 + 2 * m]), int(data[3 + 2 * m])
    print("true" if solve(n, roads, s, t) else "false")


main()
