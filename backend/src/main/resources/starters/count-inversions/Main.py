import sys


def solve(nums):
    # Return the number of pairs (i, j) with i < j and nums[i] > nums[j].
    # TODO: write your algorithm here
    return 0


def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    nums = [int(x) for x in data[1:1 + n]]
    print(solve(nums))


main()
