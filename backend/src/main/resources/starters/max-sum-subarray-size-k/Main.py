import sys


def solve(nums, k):
    # Return the largest sum of any k consecutive elements.
    # TODO: write your algorithm here
    return 0


def main():
    data = sys.stdin.buffer.read().split()
    n, k = int(data[0]), int(data[1])
    nums = [int(x) for x in data[2:2 + n]]
    print(solve(nums, k))


main()
