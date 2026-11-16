import sys


def solve(a, b, c, d):
    # Return how many index tuples (i, j, k, l) have a[i] + b[j] + c[k] + d[l] == 0.
    # TODO: write your algorithm here
    return 0


def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    lists = [[int(x) for x in data[1 + i * n:1 + (i + 1) * n]] for i in range(4)]
    print(solve(*lists))


main()
