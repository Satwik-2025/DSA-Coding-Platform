import sys


def solve(temps):
    # For each day, return how many days until a warmer one (0 if none).
    # TODO: write your algorithm here
    return [0] * len(temps)


def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    temps = [int(x) for x in data[1:1 + n]]
    print(" ".join(map(str, solve(temps))))


main()
