import sys


def solve(height):
    # Return the area of the largest rectangle that fits inside the histogram.
    # TODO: write your algorithm here
    return 0


def main():
    data = sys.stdin.buffer.read().split()
    n = int(data[0])
    nums = [int(x) for x in data[1:1 + n]]
    print(solve(nums))


main()
