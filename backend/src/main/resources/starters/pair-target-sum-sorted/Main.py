import sys


def solve(nums, target):
    # Return (i, j) with i < j and nums[i] + nums[j] == target, or (-1, -1).
    # TODO: write your algorithm here
    return (-1, -1)


def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    nums = [int(x) for x in data[1:1 + n]]
    target = int(data[1 + n])
    i, j = solve(nums, target)
    print(i, j)


main()
