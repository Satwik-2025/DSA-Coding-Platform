import sys


def solve(nums, k):
    # Return nums rotated k places to the right (you may return a new list).
    # TODO: write your algorithm here
    return nums


def main():
    data = sys.stdin.buffer.read().split()
    n, k = int(data[0]), int(data[1])
    nums = [int(x) for x in data[2:2 + n]]
    print(' '.join(map(str, solve(nums, k))))


main()
