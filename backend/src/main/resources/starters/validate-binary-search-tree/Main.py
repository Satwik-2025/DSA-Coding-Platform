import sys
from collections import deque


class TreeNode:
    def __init__(self, val):
        self.val = val
        self.left = None
        self.right = None


def solve(root):
    # Return True if the tree is a valid binary search tree (strictly smaller left, strictly larger right).
    # TODO: write your algorithm here
    return False


def build(tokens):
    # Level order: each real node, taken from a queue, consumes the next two tokens as its children.
    if not tokens or tokens[0] == "null":
        return None
    root = TreeNode(int(tokens[0]))
    queue = deque([root])
    i = 1
    while queue and i < len(tokens):
        node = queue.popleft()
        if i < len(tokens) and tokens[i] != "null":
            node.left = TreeNode(int(tokens[i]))
            queue.append(node.left)
        i += 1
        if i < len(tokens) and tokens[i] != "null":
            node.right = TreeNode(int(tokens[i]))
            queue.append(node.right)
        i += 1
    return root


def main():
    sys.setrecursionlimit(1 << 20)
    data = sys.stdin.read().split()
    m = int(data[0])
    print("true" if solve(build(data[1:1 + m])) else "false")


main()
