import sys


def solve(grid):
    # Return the number of 4-directionally connected groups of '1' cells (grid is a list of strings).
    # TODO: write your algorithm here
    return 0


def main():
    rows, cols = map(int, sys.stdin.readline().split())
    grid = [sys.stdin.readline().strip() for _ in range(rows)]
    print(solve(grid))


main()
